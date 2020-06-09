import { assert, expect } from 'chai';
import { chrome } from 'sinon-chrome/extensions';

import * as bg from '../src/background.js';

describe("Download Helper", () => {
  describe("getDB()", () => {
    it('should return an IDBDatabase', async () => {
      const db = await bg.getDB('testStore')
      expect(db instanceof IDBDatabase).to.be.true;
    });

    it('should name the database "BandcampEnhancementSuite"', async () => {
      const db = await bg.getDB('testStore')
      expect(db.name).to.equal('BandcampEnhancementSuite');
    });
  });

  describe("setVal()", () => {
    it('should store a value', async () => {
      await bg.setVal('testStore', 'testVal', 'testKey')
      const db = await bg.getDB('testStore')
      const fetched = await db.get('testStore', 'testVal')

      // Todo: resolve error:
      // Error: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
      expect(fetched).to.equal('testKey');
    });
  });
});
