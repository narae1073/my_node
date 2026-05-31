const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "node_user",
  password: "Asb@4718",
  database: "my_project_db",
});

db.connect((err) => {
  if (err) console.error("MySQL 연결 실패: " + err.stack);
  else console.log("MySQL 데이터베이스 연결 성공!");
});

module.exports = db; // 다른 곳에서 사용할 수 있게 내보내기