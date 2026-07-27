const Gallery = require("../models/Gallery");
const multer = require("multer");

// אחסון בזיכרון (ולא בדיסק)
const storage = multer.memoryStorage();
const upload = multer({ storage });

exports.upload = upload;

// העלאת תמונה ל‑Mongo
exports.addImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const newImage = await Gallery.create({
      image: req.file.buffer,
      contentType: req.file.mimetype
    });

    res.json({ success: true, id: newImage._id });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// החזרת רשימה קלה בלבד. התמונה עצמה נטענת בנפרד כדי לא לעבור
// את מגבלת גודל התגובה של Netlify.
exports.getImages = async (req, res) => {
  try {
    const images = await Gallery.find()
      .select("_id contentType createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = images.map(img => ({
      _id: img._id,
      contentType: img.contentType,
      createdAt: img.createdAt,
      image: `${req.baseUrl}/${img._id}/image`
    }));

    res.json(formatted);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// שליחת תמונה אחת ישירות מ-MongoDB
exports.getImage = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id)
      .select("image contentType")
      .lean();

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.set({
      "Content-Type": image.contentType,
      "Content-Length": image.image.length,
      "Cache-Control": "public, max-age=86400"
    });
    return res.send(image.image);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ error: "Image not found" });
    }
    return res.status(500).json({ error: error.message });
  }
};

// מחיקה
exports.deleteImage = async (req, res) => {
  try {
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
