var express = require('express');
var router = express.Router();
const { getConnection } = require('../connect');
const oracledb = require('oracledb');

/* 게시글 목록 페이지 */
router.get('/', function (req, res, next) {
    res.render('index', { title: '게시글', pageName: 'posts/list.ejs' });
});

/* 게시글 목록 데이터 (JSON) */
router.get('/list.json', async function(req, res) {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 10;
    const startRow = (page - 1) * size + 1;
    const endRow = page * size;
    let con;
    
    try {
        con = await getConnection();
        
        // 1. 전체 개수 조회 (번호 역순 계산을 위해 먼저 조회)
        let countSql = 'select count(*) as cnt from USER107.VIEW_POSTS';
        let countResult = await con.execute(countSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const total = countResult.rows[0].CNT;

        // 2. 게시글 목록 조회
        // Oracle에서 소문자 컬럼/테이블은 쌍따옴표로 감싸야 정확히 인식합니다.
        let sql = 'select * from USER107.VIEW_POSTS where "rn" between :startRow and :endRow';
        let result = await con.execute(sql, { startRow, endRow }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        // 순환 참조 에러를 완벽하게 방지하기 위한 안전 변환 처리
        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) return; // 순환 참조(부모를 다시 참조하는 부분) 무시
                    seen.add(value);
                }
                return value;
            };
        };
        const rawList = JSON.parse(JSON.stringify(result.rows, getCircularReplacer()));
        
        // 콘솔 출력 예시와 동일한 키(key) 이름으로 매핑
        const list = rawList.map(item => {
            const rn = item.rn || item.RN || 1;
            return {
                ID: item.PID || item.ID || rn || 0,
                REG_DATE: item.PDATE ? item.PDATE.replace('T', ' ').substring(0, 19) : "", // 날짜와 시간 모두 추출 (YYYY-MM-DD HH:mm:ss)
                RNUM: total - rn + 1, // 전체 개수에서 현재 순번을 빼서 아래부터 오름차순으로 번호 부여
                SNAME: item.SNAME,
                TITLE: item.TITLE || item.CONTENT || "제목 없음",
                WRITER: item.SCODE,
                CONTENT: item.CONTENT
            };
        });
        
        res.send({ list, total });
    } catch (err) {
        console.error("데이터 조회 에러:", err);
        res.status(500).send({ error: "데이터 조회 중 오류가 발생했습니다." });
    } finally {
        if (con) await con.close();
    }
});

/* 게시글 작성 페이지 이동 */
router.get('/insert', function (req, res, next) {
    res.render('index', { title: '글쓰기', pageName: 'posts/insert.ejs' });
});

/* 게시글 등록 처리 (DB에 저장) */
router.post('/insert', async function (req, res) {
    const scode = req.body.scode;
    const content = req.body.content;
    let con;
    try {
        con = await getConnection();
        // 날짜(pdate)는 오라클 테이블 생성 시 DEFAULT SYSDATE로 설정했으므로 알아서 들어갑니다.
        const sql = "INSERT INTO posts(scode, content) VALUES(:scode, :content)";
        await con.execute(sql, { scode, content }, { autoCommit: true });
        res.send('success');
    } catch (err) {
        console.error("게시글 등록 중 오류:", err);
        res.status(500).send("등록 실패");
    } finally {
        if (con) await con.close();
    }
});

module.exports = router;