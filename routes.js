const express = require("express");
const router = express.Router();
const db = require("./db"); // 위에서 만든 db.js 불러오기

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
router.get("/posts", (req, res) => {
  const sql = "SELECT * FROM posts ORDER BY created_at DESC"; // 최신글이 위로 오도록 정렬

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "데이터베이스 조회 중 에러가 발생했습니다." });
    }
    // 성공 시 조회된 게시글 목록(배열)을 JSON 형태로 응답
    res.json(results);
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
router.post("/posts", (req, res) => {
  // 1. 사용자가 보낸 데이터를 '구조 분해 할당'으로 꺼내옴
  const { title, content, author } = req.body;

  // 2. 필수 데이터가 누락되었는지 확인하는 예외 처리 (방어 코드)
  if (!title || !content || !author) {
    return res
      .status(400)
      .json({ message: "제목, 내용, 작성자는 필수 입력 항목입니다." });
  }

  // 3. MySQL에 데이터를 안전하게 집어넣기 위한 SQL 문 (물음표 3개!)
  const sql = "INSERT INTO posts (title, content, author) VALUES (?, ?, ?)";

  // 4. 대괄호 안에 변수를 순서대로 담아서 쿼리 실행
  db.query(sql, [title, content, author], (err, result) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "데이터베이스 저장 중 에러가 발생했습니다." });
    }

    // 5. 성공 시 생성된 게시글의 고유 id를 포함하여 211(Created) 상태 코드로 응답
    res.status(211).json({
      message: "게시글이 성공적으로 등록되었습니다.",
      postId: result.insertId, // MySQL이 자동으로 부여해준 id 값이야!
    });
  });
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