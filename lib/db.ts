import mysql, {type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader} from 'mysql2/promise';
const state=globalThis as unknown as {tejasviPool?:Pool};
export function pool(){
 if(!state.tejasviPool){
  if(!process.env.DATABASE_NAME||!process.env.DATABASE_USER)throw new Error('Database not configured. Open Start-Tejasvi.command to set up this project.');
  state.tejasviPool=mysql.createPool({host:process.env.DATABASE_HOST||'127.0.0.1',port:Number(process.env.DATABASE_PORT||3306),user:process.env.DATABASE_USER,password:process.env.DATABASE_PASSWORD||'',database:process.env.DATABASE_NAME,waitForConnections:true,connectionLimit:10,queueLimit:50,charset:'utf8mb4',timezone:'Z',dateStrings:true,multipleStatements:false});
 }
 return state.tejasviPool;
}
export type DB=Pool|PoolConnection;
export async function rows<T=Record<string,any>>(sql:string,values:(string|number|boolean|Date|Buffer|null)[]=[],connection:DB=pool()):Promise<T[]>{const [result]=await connection.execute<RowDataPacket[]>(sql,values);return result as T[]}
export async function one<T=Record<string,any>>(sql:string,values:(string|number|boolean|Date|Buffer|null)[]=[],connection:DB=pool()):Promise<T|null>{return (await rows<T>(sql,values,connection))[0]||null}
export async function run(sql:string,values:(string|number|boolean|Date|Buffer|null)[]=[],connection:DB=pool()){const [result]=await connection.execute<ResultSetHeader>(sql,values);return result}
export async function transaction<T>(fn:(connection:PoolConnection)=>Promise<T>):Promise<T>{const connection=await pool().getConnection();try{await connection.beginTransaction();const value=await fn(connection);await connection.commit();return value}catch(e){await connection.rollback();throw e}finally{connection.release()}}
