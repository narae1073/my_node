const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const fs = require("fs");
const db = require("./db");
const getPhotoMetadata = require("./exifExtractor");
const routes = require("./routes"); // 라우터는 이거 하나면 충분해!

const app = express();
const PORT = 3001;

// Swagger 설정
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "내 게시판 API 명세서",
      version: "1.0.0",
    },
  },
  apis: ["./index.js", "./routes.js"],
};
const swaggerSpec = swaggerJsdoc(options);

// [자동화 기능] 서버 켤 때 uploads 폴더 스캔해서 DB에 넣기
function syncUploadsFolder() {
  const directoryPath = path.join(__dirname, "uploads");
  // uploads 폴더가 없으면 자동 생성해서 에러 방지
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath);
  }

  const files = fs.readdirSync(directoryPath);

  files.forEach((file) => {
    // 📸 [여기에 확장자 검사 코드 추가!]
    const ext = path.extname(file).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      // .DS_Store 나 이미지 외의 파일은 여기서 그냥 무시하고 넘어가 버림!
      return;
    }

    const checkSql = "SELECT * FROM posts WHERE image_path = ?";
    const imagePath = `/uploads/${file}`;

    db.query(checkSql, [imagePath], (err, results) => {
      if (err) return;

      if (results.length === 0) {
        const title = file.split(".")[0];
        const insertSql =
          "INSERT INTO posts (title, content, image_path) VALUES (?, ?, ?)";

        db.query(
          insertSql,
          [title, "내용을 입력하세요", imagePath],
          async (err, result) => {
            if (err) return;
            console.log(file + " posts 등록 완료!");

            const postId = result.insertId;
            const filePath = path.join(__dirname, "uploads", file);

            // 🔍 [여기에 강제 추적 로그 추가!] 분석 시작 직전에 파일명을 무조건 찍습니다.
            console.log(`⚙️ [${file}] 메타데이터 추출을 시도합니다...`);

            const metadata = await getPhotoMetadata(filePath);

            if (metadata) {
              const metaSql =
                "INSERT INTO photo_metadata (post_id, aperture, shutter_speed, iso, taken_at, camera_model, focal_35mm) VALUES (?, ?, ?, ?, ?, ?, ?)";
              db.query(
                metaSql,
                [
                  postId,
                  metadata.aperture,
                  metadata.shutter_speed,
                  metadata.iso,
                  metadata.taken_at,
                  metadata.camera_model,
                  metadata.focal_35mm,
                ],
                (err) => {
                  if (!err) console.log(file + " 메타데이터 등록 완료!");
                },
              );
            } else {
              // 🔍 실패했을 때도 로그를 찍어줍니다.
              console.log(
                `❌ [${file}] 최종 추출 실패 (데이터 없음 혹은 에러)`,
              );
            }
          },
        );
      }
    });
  });
}

// 미들웨어 설정
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(cors());
app.use(express.json());

// 정적 파일(이미지) 접근 허용
app.use("/images", express.static("images"));
app.use("/uploads", express.static("uploads"));

// 1. 홈 화면 (index.html) 보여주기
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 2. 모든 게시판 및 업로드 기능은 routes.js로 넘기기
// 이렇게 하면 주소가 사이트주소/posts , 사이트주소/upload 가 돼!
app.use("/", routes);

// 서버 실행 전 폴더 스캔 먼저 작동!
syncUploadsFolder();

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 돌아가고 있습니다!`);
});
