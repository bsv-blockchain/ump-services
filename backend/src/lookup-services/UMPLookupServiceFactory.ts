import { AdmissionMode, LookupService, OutputAdmittedByTopic, OutputSpent, SpendNotificationMode } from '@bsv/overlay'
import type { LookupFormula } from '@bsv/overlay'
import { PushDrop, Utils } from '@bsv/sdk'
import { UMPRecord } from '../types.js'
import { Db, Collection } from 'mongodb'
import umpLookupDocs from './UMPLookupDocs.md.js'

const MAX_MATCHING_RECORDS = 200

/**
 * Implements a Lookup Service for the User Management Protocol
 */
class UMPLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'
  records: Collection<UMPRecord>

  constructor(db: Db) {
    this.records = db.collection<UMPRecord>('ump')
  }

  async getDocumentation(): Promise<string> {
    return umpLookupDocs
  }

  async getMetaData(): Promise<{ name: string; shortDescription: string; iconURL?: string; version?: string; informationURL?: string }> {
    return {
      name: 'UMP Lookup Service',
      shortDescription: 'Lookup Service for User Management Protocol tokens'
    }
  }

  async outputAdmittedByTopic(payload: OutputAdmittedByTopic) {
    if (payload.mode !== 'locking-script') throw new Error('Invalid payload')
      const { txid, outputIndex, topic, lockingScript } = payload
    if (topic !== 'tm_users') return
    // Decode the UMP fields from the Bitcoin outputScript
    const result = PushDrop.decode(lockingScript)

    // Parse protocol fields (excluding trailing signature)
    const protocolFields = result.fields

    // UMP Account Fields to store (from the UMP protocol's PushDrop field order)
    const presentationHash = Utils.toHex(protocolFields[6])
    const recoveryHash = Utils.toHex(protocolFields[7])

    // Detect v3 token: umpVersion is a single byte at field[11] (no profiles)
    // or field[12] (with profiles). Multi-byte fields[11] means profiles present.
    const hasV3AtIndex11 = protocolFields.length >= 12 && protocolFields[11]?.length === 1
    const hasV3AtIndex12 = !hasV3AtIndex11 && protocolFields.length >= 13 && protocolFields[12]?.length === 1
    const hasV3Candidate = hasV3AtIndex11 || hasV3AtIndex12
    const v3VersionIndex = hasV3AtIndex12 ? 12 : 11

    const record: UMPRecord = {
      txid,
      outputIndex,
      presentationHash,
      recoveryHash
    }

    // Add v3 metadata if present
    if (hasV3Candidate) {
      record.umpVersion = protocolFields[v3VersionIndex][0]

      const kdfAlgIndex = v3VersionIndex + 1
      const kdfParamsIndex = v3VersionIndex + 2

      const kdfAlgorithm = new TextDecoder().decode(new Uint8Array(protocolFields[kdfAlgIndex]))
      record.kdfAlgorithm = kdfAlgorithm

      const kdfParamsJson = new TextDecoder().decode(new Uint8Array(protocolFields[kdfParamsIndex]))
      try {
        const kdfParams = JSON.parse(kdfParamsJson)
        record.kdfIterations = kdfParams.iterations
      } catch (e) {
        console.warn('Failed to parse kdfParams during storage:', e)
      }
    }

    // Store UMP fields in db
    await this.records.insertOne(record)
  }

  async outputSpent(payload: OutputSpent) {
    if (payload.mode !== 'none') throw new Error('Invalid payload')
    const { topic, txid, outputIndex } = payload
    if (topic !== 'tm_users') return
    await this.records.deleteOne({ txid, outputIndex })
  }

  async outputEvicted(txid: string, outputIndex: number) {
    await this.records.deleteOne({ txid, outputIndex })
  }

  async lookup({ query }: any): Promise<LookupFormula> {
    // Validate Query
    if (!query) {
      throw new Error('Lookup must include a valid query!')
    }

    // build the filter based on which key is present
    let filter: Record<string, any>
    let exactOutpoint = false
    if (query.presentationHash) {
      filter = { presentationHash: query.presentationHash }
    } else if (query.recoveryHash) {
      filter = { recoveryHash: query.recoveryHash }
    } else if (query.outpoint) {
      const [txid, outputIndex] = (query.outpoint as string).split('.')
      filter = { txid, outputIndex: Number(outputIndex) }
      exactOutpoint = true
    } else {
      throw new Error(
        'Query parameters must include presentationHash, recoveryHash, or outpoint!'
      )
    }

    let docs: UMPRecord[]
    if (exactOutpoint) {
      const doc = await this.records.findOne(filter, { sort: { _id: -1 } })
      docs = doc ? [doc] : []
    } else {
      // Database insertion order is not token-control continuity. Return all
      // bounded candidates so the client can anchor selection to its trusted
      // pin and verify successor spends, even across confirmed predecessors.
      docs = await this.records.find(filter, { projection: { txid: 1, outputIndex: 1 } })
        .sort({ _id: -1 }).limit(MAX_MATCHING_RECORDS + 1).toArray()
      if (docs.length > MAX_MATCHING_RECORDS) {
        throw new RangeError('UMP lookup exceeds the bounded matching-record limit')
      }
    }
    const unique = new Map(docs.map(doc => [`${doc.txid}.${doc.outputIndex}`, doc]))
    return [...unique.values()].map(doc => ({
      txid: doc.txid,
      outputIndex: doc.outputIndex,
      history: () => Promise.resolve(true)
    }))
  }
}

export default (db: Db) => new UMPLookupService(db);
