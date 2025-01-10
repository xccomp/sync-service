import { createComplaint } from '#domain/use-cases/complaints/create-complaint.js'
import { getComplaints, getComplaintsById } from '#domain/use-cases/complaints/get-complaints.js'
import { ComplaintStatus } from '#domain/entities/complaint_status.js' 
import { logger } from '#logger'

export default class ComplaintsController {

  static async getComplaintById (req, res) { 
    try {
      const id = req.params.id
      const result = await getComplaintsById (id)
      return res.send(result)
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }

  static async getComplaints (req, res) { 
    try {
      const result = await getComplaints([ComplaintStatus.JUDGED])
      return res.send(result)
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }

  static async sendComplaint (req, res) { 
    try {
      const { name, phone, email, text } = req.body
      if (!name || !phone || !email || !text) {
        return res.status(400).send()
      }
      const complaint = { name, phone, email, text, sendDate: new Date(), status: ComplaintStatus.OPEN }
      const result = await createComplaint(complaint)
      const protocolNumber = result[0].id 
      return res.send({ protocolNumber })
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }

  static async addComiteeToComplaint (req, res) { 
    try {
      return res.send()
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }
  
  static async addResultToComplaint (req, res) { 
    try {
      return res.send()
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }

  static async ignoreComplaint (req, res) { 
    try {
      return res.send()
    } catch (error) {
      logger.error(error)
      return res.status(500).send(error)
    } 
  }
}
