import { ComplaintStatus } from "#domain/entities/complaint_status.js"
import XCCompDB from "#libs/xccomp-db/index.js"

export async function addResultToComplaint (complaintId, result, date) {  
  const dbClient = await XCCompDB.getClient()
  try {

    const sql = `
      UPDATE complaints 
      SET
        stauts = ?,
	      result = ?,
        result_date = ?,
        updated_at = NOW()
	    WHERE id = ?
    `
    const values = [
      ComplaintStatus.JUDGED,
      result,
      date,
      complaintId
    ]

    await dbClient.query(sql, values)
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}
