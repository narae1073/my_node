const mysql = require("mysql2");
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
const routes = require("./routes"); // 분리한 API 로직 불러오기

const PORT = 3001;
const path = require("path"); // 파일 경로를 안전하게 다루기 위한 기본 내장 모듈
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "내 게시판 API 명세서",
      version: "1.0.0",
    },
  },
  apis: ["./index.js", "./routes.js"], // 코드가 적힌 파일 경로
};
const swaggerSpec = swaggerJsdoc(options);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// 미들웨어 설정 (JSON 데이터 파싱 및 교차 출처 허용)
app.use(cors());
app.use(express.json());
// 'images' 폴더 안의 파일들을 외부에서 /images 라는 주소로 접근할 수 있게 해주는 설정
app.use("/images", express.static("images"));
app.use("/api", routes); // /api로 시작하는 모든 요청은 routes.js가 담당


app.get("/", (req, res) => {
  // path.join을 쓰면 현재 폴더 위치의 index.html을 정확히 찾아줘
  res.sendFile(path.join(__dirname, "index.html"));
});



// 서버를 3001번 포트에서 실행
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 돌아가고 있습니다!`);
});
