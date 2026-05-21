const oracledb = require('oracledb');

// oracledb 6.x 버전부터는 Thin 모드가 기본이므로 Instant Client가 필요 없습니다.
// try {
//     oracledb.initOracleClient({ libDir:'C:\\data\\oracle\\instantclient_19_30' });
// }catch(err){
//     console.log('오라클 클라이언트 초기화 실패!', err);
//     process.exit(1);
// }

async function getConnection(){
    let connection;
    try{
        connection = await oracledb.getConnection({
            user:'user107',
            password:'pass',
            connectionString:'localhost/xe'
        });
        console.log('oracle DB 연결성공');
        return connection;
    }catch(err){
        console.log('oracle DB 연결 오류:', err);
    }
}  

module.exports = {getConnection};