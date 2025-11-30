require('dotenv').config();
const express = require('express');
require('./config/database');
const morgan = require('morgan');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/userRoute');
const adminRoutes = require('./routes/adminRoute');
const trainingRoute = require('./routes/trainingRoute');
const eventRoute = require('./routes/eventRoute');
const logRoute = require('./routes/logRoute');
const awardRoute = require('./routes/awardRoute');
const snsRoute = require('./routes/snsRoute');
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");
const { checkSuspension, auth } = require('./middleware/authMiddleware');


const PORT = process.env.PORT;

const ENV = process.env.NODE_ENV || "development";
const BASE_URL =
  ENV === "production"
    ? "https://tsan.onrender.com/api"
    : `http://localhost:${PORT}/api`;


const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TSAN API",
      version: "1.0.0",
      description: "API documentation for TSAN Database Management",
    },
    servers: [{ url: "https://tsan.onrender.com/api",
        description: 'production Server'
     },
        {url: `http://localhost:${PORT}/api`, 
            description: 'Development server'
        }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/*.js"], 
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
const app = express();
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use( cors({  origin: "*" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use("/api/users", userRoutes);
app.use("/api/sns", snsRoute);
/**
 * ✅ GLOBAL SUSPENSION CHECK
 * This ensures suspended users cannot perform write operations (POST, PUT, PATCH, DELETE)
 **/
app.use(auth)
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return checkSuspension(req, res, next);
  }
  next();
});

app.use("/api/admin", adminRoutes);
app.use("/api/trainings", trainingRoute);
app.use("/api/events", eventRoute);
app.use("/api/logs", logRoute);
app.use("/api/awards", awardRoute);
app.use((err, req, res, next) => {
   if (err.type === "entity.too.large") {
    return res.status(413).json({
      status: false,
      message: "Payload too large. Please reduce request size.",
    });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ status: false, message: "File too large." });
    }
    return res.status(400).json({ status: false, message: err.message });
  }

  if (err.message && err.message.includes("Invalid file")) {
    return res.status(400).json({ status: false, message: err.message });
  }
  console.error('unexpected error:', err);
  
  res.status(500).json({ status: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API Docs available at Production- https://tsan.onrender.com/api \nDevelopment- http://localhost:${PORT}/api/docs`);
});
