import XCCompDB from "#libs/xccomp-db/index.js"


export async function createComplaint (complaint) {
  const dbClient = await XCCompDB.getClient()
  try {
    const sql = `
      INSERT INTO complaints (
	      name, phone, email, text, status, analysis_committee, result, result_date, send_date, committee_date)
	    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `
    const values = [
      complaint.name,
      complaint.phone,
      complaint.email,
      complaint.text,
      complaint.status || null,
      complaint.analysisCommittee ? JSON.stringify(complaint.analysisCommittee) : null,
      complaint.result || null,
      complaint.resultDate || null,
      complaint.sendDate || new Date(),
      complaint.committeeDate || null
    ]

    const result = await dbClient.query(sql, values)
    return result.rows
  } catch (error) {
    throw error

  } finally {
    dbClient.release()
  }
}
