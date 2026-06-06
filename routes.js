const express = require("express");
const router = express.Router();
const db = require("./db"); // 위에서 만든 db.js 불러오기
const getPhotoMetadata = require("./exifExtractor");
const path = require("path");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // 'uploads' 폴더에 저장
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // 이름 중복 방지
  },
});
const upload = multer({ storage: storage });
console.log("routes loaded");

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: 게시글 전체 조회
 *     description: 최신순으로 게시글 목록을 조회합니다.
 *     responses:
 *       200:
 *         description: 게시글 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   author:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 */
// routes.js의 게시판 목록 조회 라우터 수정

// 셔터스피드 소수를 분수 형태로 예쁘게 바꿔주는 함수
function formatShutterSpeed(shutterSpeed) {
  if (!shutterSpeed) return "정보 없음";

  const num = parseFloat(shutterSpeed);
  if (isNaN(num)) return shutterSpeed; // 혹시 이미 문자열이면 그대로 반환

  if (num >= 1) {
    // 1초 이상인 경우 (예: 1초, 2초, 30초 등 야경 촬영)
    return num + "초";
  } else {
    // 1초 미만인 경우 (예: 0.004 -> 1/250)
    // 1을 소수로 나누고 반올림(Math.round)하면 분모가 나와!
    const denominator = Math.round(1 / num);
    return `1/${denominator}초`;
  }
}

// 게시판 목록 라우터
router.get("/posts", (req, res) => {
  const sql = `
        SELECT p.*, m.aperture, m.shutter_speed, m.iso, m.taken_at, m.camera_model, m.focal_35mm 
        FROM posts p
        LEFT JOIN photo_metadata m ON p.id = m.post_id 
        ORDER BY p.created_at DESC
    `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("데이터 가져오기 실패");
    }

    let html = "<h1>사진 게시판</h1>";
    html += '<a href="/">홈으로</a><hr>';

    results.forEach((post) => {
      const takenDate = post.taken_at
        ? new Date(post.taken_at).toLocaleString("ko-KR")
        : "정보 없음";

      // 👈 여기서 방금 만든 함수로 셔터스피드를 변환해줘!
      const formattedShutter = formatShutterSpeed(post.shutter_speed);

      html += `
                <div style="border:1px solid #ccc; margin:15px; padding:15px; border-radius: 8px; max-width: 1080px;">
                    <h3>${post.title}</h3>
                    <img src="${post.image_path}" width="100%" style="border-radius: 4px;"><br>
                    <p style="margin: 10px 0;">${post.content}</p>
                    
                    <div style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 0.85em; color: #444; line-height: 1.6;">
                        <strong style="color: #000;">📸 촬영 정보 (EXIF)</strong><br>
                        • 카메라 모델: ${post.camera_model || "정보 없음"}<br>
                        • 화각 (35mm 환산): ${post.focal_35mm ? post.focal_35mm + "mm" : "정보 없음"}<br>
                        • 조리개값: ${post.aperture ? "f/" + post.aperture : "정보 없음"}<br>
                        • 셔터스피드: ${formattedShutter}<br> • ISO: ${post.iso || "정보 없음"}<br>
                        • 촬영 일시: ${takenDate}
                    </div>
                    
                    <hr style="border: 0; border-top: 1px dashed #eee; margin: 10px 0;">
                    <small style="color: #aaa;">업로드일: ${new Date(post.created_at).toLocaleString("ko-KR")}</small>
                </div>
            `;
    });

    res.send(html);
  });
});

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: 게시글 상세 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 게시글 ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 게시글 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 author:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 존재하지 않는 게시글
 */
router.get("/posts/:id", (req, res) => {
  // 주소창에 담겨온 id 값을 꺼내옴 (예: req.params.id는 "1" 또는 "2"가 됨)
  const { id } = req.params;

  // 물음표(?)를 사용해 사용자가 입력한 id 값을 안전하게 대입하는 SQL 쿼리문
  const sql = "SELECT * FROM posts WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "데이터베이스 조회 중 에러가 발생했습니다." });
    }

    // 만약 데이터베이스에서 일치하는 id의 게시글을 찾지 못했다면 (배열이 비어있다면)
    if (results.length === 0) {
      return res.status(404).json({ message: "존재하지 않는 게시글입니다." });
    }

    // 성공 시 배열의 첫 번째 원소(객체 1개)만 깔끔하게 응답
    res.json(results[0]);
  });
});

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: 게시글 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - author
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               author:
 *                 type: string
 *     responses:
 *       211:
 *         description: 게시글 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 postId:
 *                   type: integer
 *       400:
 *         description: 필수값 누락
 */
router.post("/upload", upload.single("photo"), async (req, res) => {
  const filename = req.file.filename;
  const title = filename.split(".")[0];
  const imagePath = `/uploads/${filename}`;

  const sql = "INSERT INTO posts (title, content, image_path) VALUES (?, ?, ?)";

  // 주의: 여기도 async!
  db.query(
    sql,
    [title, "내용을 입력하세요", imagePath],
    async (err, result) => {
      if (err) {
        return res.status(500).send("DB 저장 실패");
      }

      const postId = result.insertId; // 방금 생성된 글 번호

      // --- [메타데이터 추출 및 저장 로직 시작] ---
      const filePath = path.join(__dirname, "uploads", filename);
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
            if (!err) console.log(filename + " 메타데이터 등록 완료!");
          },
        );
      }
      // --- [메타데이터 추출 및 저장 로직 끝] ---

      res.send("사진과 촬영 정보가 게시판에 등록되었습니다!");
    },
  );
});

/**
 * @swagger
 * /api/posts/{id}:
 *   patch:
 *     summary: 게시글 수정
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 수정할 게시글 ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 *       400:
 *         description: 요청 데이터 부족
 *       404:
 *         description: 게시글 없음
 */
router.patch("/posts/:id", (req, res) => {
  const { id } = req.params; // 주소에서 고칠 글의 id를 꺼내옴
  const { title, content } = req.body; // 수정할 제목과 내용을 꺼내옴

  // 1. 수정할 내용이 들어왔는지 확인
  if (!title || !content) {
    return res
      .status(400)
      .json({ message: "제목과 내용을 모두 입력해주세요." });
  }

  // 2. SQL UPDATE 쿼리문
  const sql = "UPDATE posts SET title = ?, content = ? WHERE id = ?";

  // 3. 쿼리 실행 (순서대로 ?에 들어감: title, content, id)
  db.query(sql, [title, content, id], (err, result) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "데이터베이스 수정 중 에러가 발생했습니다." });
    }

    // 4. 만약 수정된 행이 없다면 (id가 잘못된 경우)
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "수정할 게시글을 찾을 수 없습니다." });
    }

    res.json({ message: "게시글이 성공적으로 수정되었습니다." });
  });
});

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: 게시글 삭제
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 삭제할 게시글 ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 게시글 없음
 */
router.delete("/posts/:id", (req, res) => {
  const { id } = req.params; // 주소에서 지울 글의 id를 꺼내옴

  // 1. MySQL DELETE 쿼리문
  const sql = "DELETE FROM posts WHERE id = ?";

  // 2. 쿼리 실행
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "데이터베이스 삭제 중 에러가 발생했습니다." });
    }

    // 3. 수정 때와 마찬가지로 삭제된 행이 있는지 확인
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "삭제할 게시글을 찾을 수 없습니다." });
    }

    res.json({ message: "게시글이 성공적으로 삭제되었습니다." });
  });
});

// 나머지 POST, PATCH, DELETE 로직들도 여기에 붙여넣기!
// 주의: app.post 대신 router.post를 사용해야 해.

module.exports = router;
