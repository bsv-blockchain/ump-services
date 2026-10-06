import { describe, it, expect, jest } from '@jest/globals'
import type { Db } from 'mongodb'
import UMPLookupServiceFactory from '../lookup-services/UMPLookupServiceFactory.js'

describe('UMP retained lineage selection', () => {
  it.each([
    [{ presentationHash: 'presentation' }, { presentationHash: 'presentation' }],
    [{ recoveryHash: 'recovery' }, { recoveryHash: 'recovery' }],
    [{ outpoint: 'current.2' }, { txid: 'current', outputIndex: 2 }]
  ])('requests history for the existing lookup filter %j', async (query, filter) => {
    const findOne = jest.fn(async () => ({ txid: 'current', outputIndex: 2 }))
    const toArray = jest.fn(async () => [{ txid: 'current', outputIndex: 2 }]);const limit = jest.fn(() => ({ toArray }));const sort = jest.fn(() => ({ limit }));const find = jest.fn(() => ({ sort }))
    const collection = jest.fn(() => ({ findOne, find }))
    const service = UMPLookupServiceFactory({ collection } as unknown as Db)
    const result = await service.lookup({ query })

    expect(collection).toHaveBeenCalledWith('ump')
    if ('outpoint' in query) expect(findOne).toHaveBeenCalledWith(filter, { sort: { _id: -1 } })
    else { expect(find).toHaveBeenCalledWith(filter, { projection: { txid: 1, outputIndex: 1 } });expect(sort).toHaveBeenCalledWith({ _id: -1 });expect(limit).toHaveBeenCalledWith(201) }
    expect(result).toHaveLength(1)
    expect(result[0].txid).toBe('current')
    expect(result[0].outputIndex).toBe(2)
    const history = result[0].history
    if (typeof history !== 'function') throw new Error('Missing retained lineage selector')
    await expect(history([], 2, 0)).resolves.toBe(true)
    await expect(history([], 0, 8)).resolves.toBe(true)
  })

  it('does not fabricate a lineage subject when the lookup has no record', async () => {
    const findOne = jest.fn(async () => null)
    const service = UMPLookupServiceFactory({
      collection: () => ({ findOne, find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }) })
    } as unknown as Db)
    await expect(service.lookup({ query: { presentationHash: 'missing' } })).resolves.toEqual([])
  })
})
