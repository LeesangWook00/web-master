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
        // 최신 글이 먼저 보이도록(내림차순 정렬) ORDER BY id DESC 구문을 먼저 실행하고,
        // 정렬된 결과에 ROWNUM을 부여하도록 쿼리를 3중 서브쿼리로 수정합니다.
        let sql = `
            SELECT * FROM (
                SELECT a.*, ROWNUM rn FROM (
                    SELECT * FROM USER107.VIEW_POSTS ORDER BY id DESC
                ) a WHERE ROWNUM <= :endRow
            ) WHERE rn >= :startRow
        `;
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
            
            // 제목이 30자를 초과할 경우 말줄임표 처리
            let title = item.TITLE || item.CONTENT || "제목 없음";
            if (title.length > 30) title = title.substring(0, 30) + "...";

            return {
                ID: item.ID || rn || 0,
                REG_DATE: item.FMT_DATE || "", // 뷰에서 생성한 FMT_DATE 컬럼을 사용해 작성일 표시
                RNUM: total - rn + 1, // 전체 개수에서 현재 순번을 빼서 아래부터 오름차순으로 번호 부여
                SNAME: item.SNAME,
                TITLE: title,
                WRITER: item.WRITER, // 뷰에 있는 WRITER 컬럼 매핑
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
    // 1. 프론트엔드에서 어떤 데이터가 넘어오는지 터미널에서 확인하기 위해 로그를 찍습니다.
    console.log("등록 요청 데이터:", req.body);

    // 2. oracledb는 값이 undefined이면 에러(NJS-044)를 발생시키므로 null 또는 빈 문자열로 처리합니다.
    const writer = req.body.writer || req.body.scode || req.body.SCODE || null; 
    const content = req.body.content || "";
    const title = req.body.title || (content ? content.substring(0, 30) : "제목 없음");

    let con;
    try {
        con = await getConnection();
        
        // posts 테이블의 ID 컬럼이 GENERATED ALWAYS AS IDENTITY로 변경되었으므로, INSERT 시 ID를 제외하고 삽입합니다.
        const sql = "INSERT INTO posts(writer, title, content) VALUES(:writer, :title, :content)";
        await con.execute(sql, { writer, title, content }, { autoCommit: true });
        res.send('success');
    } catch (err) {
        console.error("게시글 등록 중 오류:", err);
        // 3. 브라우저나 콘솔에서도 원인을 바로 알 수 있도록 에러 내용을 함께 보냅니다.
        res.status(500).send("등록 실패: " + err.message);
    } finally {
        if (con) await con.close();
    }
});

module.exports = router;