const express = require("express");
const router = express.Router();

const {
  getAllAppointments,
  getAppointment,
  deleteAppointment
} = require("../controllers/appointmentController");

const {
  createAppointment,
  confirmDemoDeposit
} = require("../controllers/bookingController");

const {
  getAvailableSlots
} = require("../controllers/availabilityController");

const {
  updateAppointment
} = require("../controllers/appointmentEditController");

router.post("/", createAppointment);
router.post("/:id/deposit/confirm", confirmDemoDeposit);
router.get("/available/:date", getAvailableSlots);

router.get("/", getAllAppointments);
router.get("/:id", getAppointment);
router.put("/:id", updateAppointment);
router.delete("/:id", deleteAppointment);

module.exports = router;
