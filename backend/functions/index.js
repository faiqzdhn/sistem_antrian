const {onRequest, onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

// Daftar email admin
const ADMIN_EMAILS = [
  "admin@antrian.com",
  // Tambahkan email admin lain di sini
];

// Function untuk generate ticket
exports.generateTicket = onCall(
  {region: "us-central1"},
  async (request) => {
    try {
      const db = admin.firestore();
      const queueRef = db.collection("system").doc("queueState");
      const ticketsRef = db.collection("tickets");

      const result = await db.runTransaction(async (transaction) => {
        const queueDoc = await transaction.get(queueRef);

        let newNumber;
        let needsReset = false;

        if (!queueDoc.exists) {
          // Jika belum ada, buat dokumen baru dengan currentNumber = 1
          transaction.set(queueRef, {
            currentNumber: 1,
            lastReset: new Date(),
          });
          newNumber = 1;
        } else {
          const queueData = queueDoc.data();
          const lastReset = queueData.lastReset?.toDate();
          const today = new Date();

          // Check if last reset was on a different day
          if (lastReset) {
            const lastResetDay = new Date(
              lastReset.getFullYear(),
              lastReset.getMonth(),
              lastReset.getDate()
            );
            const currentDay = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate()
            );

            needsReset = lastResetDay < currentDay;
          }

          if (needsReset) {
            // Auto reset untuk hari baru
            logger.info("Auto-resetting queue for new day");
            transaction.set(queueRef, {
              currentNumber: 1,
              currentCalled: 0,
              lastReset: new Date(),
            });
            newNumber = 1;
          } else {
            // Jika sudah ada dan masih hari yang sama, increment currentNumber
            newNumber = (queueData.currentNumber || 0) + 1;
            transaction.update(queueRef, {currentNumber: newNumber});
          }
        }
        return {newNumber, needsReset};
      });

      // If reset happened, delete old tickets
      if (result.needsReset) {
        const snapshot = await ticketsRef.get();
        const batchSize = 500;
        let batch = db.batch();
        let count = 0;

        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          count++;
          if (count >= batchSize) {
            batch.commit();
            batch = db.batch();
            count = 0;
          }
        });

        if (count > 0) {
          await batch.commit();
        }
        logger.info(`Auto-deleted ${snapshot.size} old tickets for new day`);
      }

      const ticketDoc = await ticketsRef.add({
        ticketNumber: result.newNumber,
        status: "waiting",
        createdAt: new Date(),
      });

      logger.info(`Ticket generated: ${result.newNumber}`, {
        ticketId: ticketDoc.id,
      });
      return {
        success: true,
        ticketNumber: result.newNumber,
        ticketId: ticketDoc.id,
      };
    } catch (error) {
      logger.error("Error generating ticket:", error);
      throw new Error("Gagal generate ticket: " + error.message);
    }
  },
);

// Function untuk call next ticket (Admin Only)
exports.callNext = onCall({region: "us-central1"}, async (request) => {
  try {
    // Cek autentikasi
    if (!request.auth) {
      throw new Error("Harus login terlebih dahulu");
    }

    // Cek apakah user adalah admin
    const userEmail = request.auth.token.email;
    if (!ADMIN_EMAILS.includes(userEmail)) {
      throw new Error("Admin only - Email Anda tidak terdaftar sebagai admin");
    }

    const db = admin.firestore();
    const ticketsRef = db.collection("tickets");
    const queueRef = db.collection("system").doc("queueState");

    // Get current queue state
    const queueDoc = await queueRef.get();
    const currentCalled = queueDoc.exists ? queueDoc.data().currentCalled : 0;

    // Set status 'done' untuk ticket yang sebelumnya dipanggil
    if (currentCalled > 0) {
      const prevCalled = await ticketsRef
        .where("status", "==", "called")
        .where("ticketNumber", "==", currentCalled)
        .get();

      if (!prevCalled.empty) {
        await prevCalled.docs[0].ref.update({
          status: "done",
          doneAt: new Date(),
        });
      }
    }

    // Cari ticket dengan status waiting, urutkan berdasarkan ticketNumber
    const waitingTickets = await ticketsRef
      .where("status", "==", "waiting")
      .orderBy("ticketNumber", "asc")
      .limit(1)
      .get();

    if (waitingTickets.empty) {
      return {success: false, message: "Tidak ada antrian"};
    }

    const nextTicket = waitingTickets.docs[0];
    const nextTicketNumber = nextTicket.data().ticketNumber;

    // Set status 'missed' untuk ticket yang terlewat
    if (currentCalled > 0 && nextTicketNumber > currentCalled + 1) {
      const missedTickets = await ticketsRef
        .where("status", "==", "waiting")
        .where("ticketNumber", ">", currentCalled)
        .where("ticketNumber", "<", nextTicketNumber)
        .get();

      const batch = db.batch();
      missedTickets.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "missed",
          missedAt: new Date(),
        });
      });
      await batch.commit();
    }

    // Call next ticket
    await nextTicket.ref.update({
      status: "called",
      calledAt: new Date(),
    });

    // Update currentCalled di queue state
    await queueRef.set({
      currentCalled: nextTicketNumber,
      lastCalledAt: new Date(),
    }, {merge: true});

    logger.info(`Ticket called: ${nextTicketNumber}`, {
      ticketId: nextTicket.id,
      admin: userEmail,
    });

    return {
      success: true,
      ticketNumber: nextTicketNumber,
      ticketId: nextTicket.id,
    };
  } catch (error) {
    logger.error("Error calling next ticket:", error);
    throw new Error("Gagal memanggil nomor: " + error.message);
  }
});

// Function untuk reset queue (Admin Only)
exports.resetQueue = onCall({region: "us-central1"}, async (request) => {
  try {
    // Cek autentikasi
    if (!request.auth) {
      throw new Error("Harus login terlebih dahulu");
    }

    // Cek apakah user adalah admin
    const userEmail = request.auth.token.email;
    if (!ADMIN_EMAILS.includes(userEmail)) {
      throw new Error("Admin only - Email Anda tidak terdaftar sebagai admin");
    }

    const db = admin.firestore();
    const queueRef = db.collection("system").doc("queueState");
    const ticketsRef = db.collection("tickets");

    // Delete all tickets in batches
    const snapshot = await ticketsRef.get();
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      if (count >= batchSize) {
        batch.commit();
        batch = db.batch();
        count = 0;
      }
    });

    // Commit remaining deletes
    if (count > 0) {
      await batch.commit();
    }

    // Reset queue state
    await queueRef.set({
      currentNumber: 0,
      currentCalled: 0,
      lastReset: new Date(),
    });

    logger.info("Queue reset - deleted tickets", {
      admin: userEmail,
      deletedCount: snapshot.size,
    });
    return {
      success: true,
      message: `Antrian berhasil direset (${snapshot.size} tickets dihapus)`,
    };
  } catch (error) {
    logger.error("Error resetting queue:", error);
    throw new Error("Gagal reset antrian: " + error.message);
  }
});

// Scheduled function untuk auto-reset setiap tengah malam (00:00 WIB / GMT+7)
// Runs at midnight Asia/Jakarta timezone
exports.scheduledQueueReset = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Jakarta",
    region: "us-central1",
  },
  async (event) => {
    try {
      const db = admin.firestore();
      const queueRef = db.collection("system").doc("queueState");
      const ticketsRef = db.collection("tickets");

      // Delete all tickets in batches
      const snapshot = await ticketsRef.get();
      const batchSize = 500;
      let batch = db.batch();
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
        if (count >= batchSize) {
          batch.commit();
          batch = db.batch();
          count = 0;
        }
      });

      // Commit remaining deletes
      if (count > 0) {
        await batch.commit();
      }

      // Reset queue state
      await queueRef.set({
        currentNumber: 0,
        currentCalled: 0,
        lastReset: new Date(),
      });

      logger.info("Scheduled queue reset completed", {
        deletedCount: snapshot.size,
        timestamp: new Date().toISOString(),
      });

      return null;
    } catch (error) {
      logger.error("Error in scheduled queue reset:", error);
      throw error;
    }
  }
);