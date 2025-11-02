const multer = require('multer');
const path = require('path');



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {cb(null, true);}
  else {cb(new Error('Invalid file type. Only images are allowed.'));}
};


const generalFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/gif',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.oasis.opendocument.text', // .odt
    'application/rtf', // .rtf
    'text/plain', // .txt
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // ✅ Accept
  } else {
    cb(
      new Error(
        `Invalid file format: ${file.mimetype}. Only images, PDFs, docs, and Excel files are allowed.`
      )
    );
  }
};

const uploadProfilePic = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 1024 * 1024 * 2 } 
});

const uploadGeneralFile = multer({
  storage,
  fileFilter: generalFileFilter,
  limits: { fileSize: 1024 * 1024 * 10 } 
});

module.exports = { uploadProfilePic, uploadGeneralFile };
