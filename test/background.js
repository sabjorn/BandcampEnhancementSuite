import { assert, expect } from 'chai';
import { chrome } from 'sinon-chrome/extensions';

import * as bg from '../src/background.js';

describe("Download Helper", () => {
  describe("getDB()", () => {
    it('should return an openDB', async () => {
      const db = await bg.getDB('testdb')
      console.log(db)
    });
  });
});
