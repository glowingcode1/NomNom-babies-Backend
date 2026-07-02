const PDFDocument = require("pdfkit");

const generateFeedingSchedulePdf = (baby, schedules) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument();

    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    doc.fontSize(22).text("Feeding TimeTable");

    doc.moveDown();

    doc.fontSize(14).text(`Baby: ${baby.name}`);

    doc.text(`Stage: ${baby.babyStage?.title || ""}`);

    doc.moveDown();

    schedules.forEach((item) => {
      doc.fontSize(13).text(item.time);
      doc.fontSize(12).text(item.title);
      doc
        .fontSize(11)
        .fillColor("gray")
        .text(item.description || "");

      doc.moveDown();
    });

    doc.end();
  });
};

const generateRecipePdf = (recipe) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument();

    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    doc.fontSize(22).text(recipe.title);

    doc.moveDown();

    doc.fontSize(12).text(`Meal Type: ${recipe.mealType}`);

    doc.text(`Prep Time: ${recipe.prepTime} min`);

    doc.text(`Country: ${recipe.country?.name || ""}`);

    doc.moveDown();

    doc.fontSize(16).text("Ingredients");

    doc.moveDown(0.5);

    recipe.ingredients.forEach((ingredient) => {
      doc.fontSize(12).text(`${ingredient.name}`);
    });

    doc.moveDown();

    doc.fontSize(16).text("Instructions");

    doc.moveDown();

    recipe.instructions.forEach((step, index) => {
      doc.text(`${index + 1}. ${step}`);
    });

    doc.end();
  });
};

const generateGroceryPdf = (grocery) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument();

    const buffers = [];

    doc.on(
      "data",

      buffers.push.bind(buffers),
    );

    doc.on(
      "end",

      () => {
        resolve(Buffer.concat(buffers));
      },
    );

    doc
      .fontSize(22)

      .text("Grocery List");

    doc.moveDown();

    grocery.recipes.forEach((recipe) => {
      doc
        .fontSize(15)

        .text(recipe.recipe.title);

      doc.moveDown(0.5);

      recipe.ingredients.forEach((ingredient) => {
        doc
          .fontSize(12)

          .text(
            `${ingredient.checked ? "☑" : "☐"}

${ingredient.name}

(${ingredient.quantity})`,
          );
      });

      doc.moveDown();
    });

    doc.end();
  });
};

module.exports = {
  generateFeedingSchedulePdf,
  generateRecipePdf,
  generateGroceryPdf,
};
