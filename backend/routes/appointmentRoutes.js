const express = require("express");
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  getAllAppointments,
  getAppointment,
  deleteAppointment
} = require("../controllers/appointmentController");

const {
  createAppointment,
  confirmDemoDeposit,
  getDepositPaymentDetails
} = require("../controllers/bookingController");

const {
  getAvailableSlots
} = require("../controllers/availabilityController");

const {
  updateAppointment
} = require("../controllers/appointmentEditController");

router.post("/", createAppointment);
router.post("/:id/deposit/confirm", confirmDemoDeposit);
router.get("/payment/:id", getDepositPaymentDetails);
router.get("/available/:date", getAvailableSlots);

router.get("/", protect, getAllAppointments);
router.get("/:id", protect, getAppointment);
router.put("/:id", protect, updateAppointment);
router.delete("/:id", protect, deleteAppointment);

module.exports = router;
