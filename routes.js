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
 * get:
 * summary: 게시글 전체 조회
 * description: 최신순으로 게시글 목록을 조회합니다.
 */

// 셔터스피드 소수를 분수 형태로 예쁘게 바꿔주는 함수
function formatShutterSpeed(shutterSpeed) {
  if (!shutterSpeed) return "정보 없음";

  const num = parseFloat(shutterSpeed);
  if (isNaN(num)) return shutterSpeed; // 혹시 이미 문자열이면 그대로 반환

  if (num >= 1) {
    return num + "";
  } else {
    const denominator = Math.round(1 / num);
    return `1/${denominator}`;
  }
}

// 📊 [신규] 날짜별 촬영 사진 개수를 통계 내어주는 API
router.get("/api/heatmap", (req, res) => {
  const sql = `
    SELECT DATE_FORMAT(taken_at, '%Y-%m-%d') as date, COUNT(*) as count 
    FROM photo_metadata 
    WHERE taken_at IS NOT NULL 
    GROUP BY date
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "통계 가져오기 실패" });
    res.json(results);
  });
});

// 게시판 목록 라우터
router.get("/posts", (req, res) => {
  const selectedDate = req.query.date;

  // 1️⃣ 가장 최근에 사진을 '찍은' 날짜 찾기 
  const recentDateSql = `
    SELECT DATE_FORMAT(taken_at, '%Y-%m-%d') as latest_date 
    FROM photo_metadata 
    WHERE taken_at IS NOT NULL 
    ORDER BY taken_at DESC LIMIT 1
  `;

  db.query(recentDateSql, (err, recentResult) => {
    if (err) return res.status(500).send("최근 날짜 조회 실패");

    // 유저가 날짜를 눌렀으면 그 날짜, 안 눌렀으면 DB에서 찾은 가장 최근 날짜로!
    const targetDate = selectedDate || (recentResult.length > 0 ? recentResult[0].latest_date : null);

    // 2️⃣ 타겟 날짜에 찍힌 사진만 가져오는 쿼리 준비
    let postsSql = `
      SELECT p.*, m.aperture, m.shutter_speed, m.iso, m.taken_at, m.camera_model, m.focal_35mm 
      FROM posts p
      LEFT JOIN photo_metadata m ON p.id = m.post_id 
    `;
    let queryParams = [];

    // 'unknown'이면 메타데이터가 없는 사진만, 특정 날짜면 그 날짜만!
    if (targetDate === 'unknown') {
      postsSql += ` WHERE m.taken_at IS NULL `;
    } else if (targetDate) {
      postsSql += ` WHERE DATE_FORMAT(m.taken_at, '%Y-%m-%d') = ? `;
      queryParams.push(targetDate);
    }
    
    postsSql += ` ORDER BY m.taken_at DESC, p.created_at DESC`;

    db.query(postsSql, queryParams, (err, results) => {
      if (err) return res.status(500).send("데이터 가져오기 실패");

      // 화면 출력할 텍스트 분기 처리
      let displayTargetText = targetDate;
      if (targetDate === 'unknown') displayTargetText = "정보 없는 사진 (메타데이터 없음)";
      else if (!targetDate) displayTargetText = "사진 없음";

      // 3️⃣ 화면(HTML) 뼈대 만들기 (연도 이동 및 버튼 추가)
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>사진 게시판</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background-color: #f8f9fa; }
            
            /* 잔디밭(Heatmap) CSS */
            .heatmap-wrapper {
              background-color: #0d1117; padding: 20px; border-radius: 6px;
              display: inline-block; margin-bottom: 20px; border: 1px solid #30363d;
            }
            .heatmap-header {
              display: flex; justify-content: space-between; align-items: center;
              margin-bottom: 15px; color: #c9d1d9;
            }
            .nav-btn {
              background-color: #21262d; border: 1px solid #30363d; color: #c9d1d9;
              padding: 5px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;
            }
            .nav-btn:hover { background-color: #30363d; }
            
            #heatmap-container { 
              display: flex; flex-wrap: wrap; gap: 4px; width: 800px; 
            }
            .day-box { 
              width: 14px; height: 14px; background-color: #161b22; 
              border-radius: 2px; cursor: pointer; transition: transform 0.1s;
              border: 1px solid rgba(27,31,35,0.06);
            }
            .day-box:hover { transform: scale(1.3); z-index: 10; border: 1px solid #fff; }
            
            .level-1 { background-color: #0e4429; }
            .level-2 { background-color: #006d32; }
            .level-3 { background-color: #26a641; }
            .level-4 { background-color: #39d353; }
            
            .btn-unknown {
              background-color: #2da44e; color: white; border: none;
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-weight: bold; font-size: 13px;
            }
            .btn-unknown:hover { background-color: #2c974b; }
            
            .info-text { color: #666; margin-bottom: 30px; }
            .active-date { color: #e5534b; font-weight: bold; font-size: 1.2em; }
          </style>
        </head>
        <body>
          <h1 style="color: #333;">📸 사진 갤러리</h1>
          <a href="/" style="color: #0969da; text-decoration: none;">← 홈으로</a>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
          
          <div class="heatmap-wrapper">
            <div class="heatmap-header">
              <button class="nav-btn" id="prev-year">◀ 이전 연도</button>
              <h3 style="margin: 0;"><span id="year-display"></span>년 촬영 기록</h3>
              <button class="nav-btn" id="next-year">다음 연도 ▶</button>
            </div>
            
            <div id="heatmap-container"></div>
            
            <!-- 정보 없는 사진 따로 보기 버튼 -->
            <div style="margin-top: 20px; text-align: right; border-top: 1px solid #30363d; padding-top: 15px;">
              <button class="btn-unknown" onclick="window.location.href='/posts?date=unknown'">
                🤷‍♂️ 촬영 날짜가 없는 사진 모아보기
              </button>
            </div>
          </div>
          
          <div class="info-text">
            현재 보고 있는 날짜: <span class="active-date">${displayTargetText}</span> 
            (${results.length}장의 사진)
            ${selectedDate ? '<br><a href="/posts" style="font-size:14px; color: #0969da; display:inline-block; margin-top:10px;">전체 (가장 최근) 보기 취소</a>' : ''}
          </div>
      `;

      // 4️⃣ 필터링된 사진 목록 그리기
      if (results.length === 0) {
        html += `<p>해당 조건의 사진이 없습니다!</p>`;
      } else {
        results.forEach((post) => {
          const takenDate = post.taken_at ? new Date(post.taken_at).toLocaleString("ko-KR") : "정보 없음";
          const formattedShutter = formatShutterSpeed(post.shutter_speed);

          html += `
            <div style="background: white; border:1px solid #ccc; margin-bottom:20px; padding:20px; border-radius: 8px; max-width: 800px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h3 style="margin-top: 0;">${post.title}</h3>
                <img src="${post.image_path}" width="100%" style="border-radius: 4px;"><br>
                <p style="margin: 15px 0;">${post.content}</p>
                
                <div style="background-color: #f6f8fa; padding: 15px; border-radius: 6px; font-size: 0.9em; color: #24292f; line-height: 1.6; border: 1px solid #d0d7de;">
                    <strong style="color: #000;">📸 촬영 정보 (EXIF)</strong><br>
                    ${post.camera_model || "정보 없음"}, 
                    ${post.focal_35mm ? post.focal_35mm + "mm" : "정보 없음"}, 
                    ${post.aperture ? "f/" + post.aperture : "정보 없음"}, 
                    ${formattedShutter}, 
                    ISO ${post.iso || "정보 없음"}<br>
                    • <strong>촬영 일시: <span style="color:#0969da">${takenDate}</span></strong>
                </div>
            </div>
          `;
        });
      }

      // 5️⃣ 화면 밑단 및 연도별 동적 잔디 생성 스크립트
      html += `
          <script>
            // JS 변수 세팅
            const initialTarget = '${targetDate || ""}';
            let currentYear = new Date().getFullYear();
            
            // 만약 2023-10-25 같은 특정 날짜를 보고 있다면, 잔디밭도 해당 연도(2023)로 세팅
            if (initialTarget && initialTarget !== 'unknown') {
                currentYear = parseInt(initialTarget.substring(0, 4));
            }

            let heatData = {}; // 서버에서 가져온 전체 통계 저장소

            // API 호출 후 렌더링
            fetch('/api/heatmap')
              .then(res => res.json())
              .then(data => {
                data.forEach(item => {
                    heatData[item.date] = item.count;
                });
                renderHeatmap(currentYear);
              });

            // 특정 연도의 잔디밭 그리는 함수
            function renderHeatmap(year) {
                currentYear = year;
                document.getElementById('year-display').innerText = year;
                const container = document.getElementById('heatmap-container');
                container.innerHTML = ''; // 기존 잔디 초기화

                // 해당 연도의 1월 1일부터 12월 31일까지 생성
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);

                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dateString = \`\${y}-\${m}-\${day}\`;

                    const count = heatData[dateString] || 0;
                    const box = document.createElement('div');
                    box.className = 'day-box';
                    box.title = \`\${dateString} : \${count}장 촬영\`;
                    
                    if (count === 1) box.classList.add('level-1');
                    else if (count === 2 || count === 3) box.classList.add('level-2');
                    else if (count >= 4 && count <= 6) box.classList.add('level-3');
                    else if (count >= 7) box.classList.add('level-4');

                    box.onclick = () => {
                        if(count > 0) window.location.href = '/posts?date=' + dateString;
                        else alert('이 날짜에는 찍은 사진이 없어요! 빈 잔디입니다.');
                    };
                    
                    container.appendChild(box);
                }
            }

            // 화살표 버튼 클릭 이벤트
            document.getElementById('prev-year').onclick = () => renderHeatmap(currentYear - 1);
            document.getElementById('next-year').onclick = () => renderHeatmap(currentYear + 1);
          </script>
        </body>
        </html>
      `;

      res.send(html);
    });
  });
});

/**
 * @swagger
 * /api/posts/{id}:
 * get: ...
 */
router.get("/posts/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM posts WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: "데이터베이스 조회 중 에러" });
    if (results.length === 0) return res.status(404).json({ message: "게시글 없음" });
    res.json(results[0]);
  });
});

router.post("/upload", upload.single("photo"), async (req, res) => {
  const filename = req.file.filename;
  const title = filename.split(".")[0];
  const imagePath = `/uploads/${filename}`;

  const sql = "INSERT INTO posts (title, content, image_path) VALUES (?, ?, ?)";
  db.query(sql, [title, "내용을 입력하세요", imagePath], async (err, result) => {
    if (err) return res.status(500).send("DB 저장 실패");

    const postId = result.insertId;
    const filePath = path.join(__dirname, "uploads", filename);
    const metadata = await getPhotoMetadata(filePath);

    if (metadata) {
      const metaSql = "INSERT INTO photo_metadata (post_id, aperture, shutter_speed, iso, taken_at, camera_model, focal_35mm) VALUES (?, ?, ?, ?, ?, ?, ?)";
      db.query(metaSql, [postId, metadata.aperture, metadata.shutter_speed, metadata.iso, metadata.taken_at, metadata.camera_model, metadata.focal_35mm], (err) => {
        if (!err) console.log(filename + " 메타데이터 등록 완료!");
      });
    }
    res.send("사진과 촬영 정보가 게시판에 등록되었습니다!");
  });
});

router.patch("/posts/:id", (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ message: "제목과 내용을 모두 입력해주세요." });
  
  const sql = "UPDATE posts SET title = ?, content = ? WHERE id = ?";
  db.query(sql, [title, content, id], (err, result) => {
    if (err) return res.status(500).json({ error: "데이터베이스 수정 중 에러" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "게시글 없음" });
    res.json({ message: "수정 성공" });
  });
});

router.delete("/posts/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM posts WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: "삭제 중 에러" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "게시글 없음" });
    res.json({ message: "삭제 성공" });
  });
});

module.exports = router;