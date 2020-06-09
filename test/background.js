import { assert, expect } from 'chai';
import { chrome } from 'sinon-chrome/extensions';

//import { getDB } from '../src/background.js'
import * as background from '../src/background.js';

it('should add to numbers from an es module', () => {
  assert.equal(8, 8);
});
