import { ComplaintStatus } from "#domain/entities/complaint_status.js"
import XCCompDB from "#libs/xccomp-db/index.js"


export async function addCommitteeToComplaint (complaintId, committee, date) {
  if (
    !Array.isArray(committee) 
    || committee.length != 3 
    || committee.some(s => typeof s !== "string")
    || committee.some(s => s.trim() === '')
  ) {
    throw new Error('O parâmetro "committee" deve ser um array com três nomes')
  }
  
  const dbClient = await XCCompDB.getClient()
  try {

    const sql = `
      UPDATE complaints 
      SET
        stauts = ?,
	      analysis_committee = ?,
        committee_date = ?,
        updated_at = NOW()
	    WHERE id = ?
    `
    const values = [
      ComplaintStatus.UNDER_ANALYSIS,
      JSON.stringify(committee),
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
