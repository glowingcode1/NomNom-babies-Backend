const mongoose = require("mongoose");

const adminActivitySchema = new mongoose.Schema(
  {
    action: String,
    detail: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const AdminActivity =
  mongoose.models.AdminActivity ||
  mongoose.model("AdminActivity", adminActivitySchema);
module.exports = AdminActivity;
