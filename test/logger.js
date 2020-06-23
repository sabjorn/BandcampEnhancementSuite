import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai'
import { assert, expect } from 'chai';
chai.use(sinonChai);

import * as winston from "winston";
import Logger from '../src/logger.js';

describe("Logger", () => {
  it("should instantiate a logger", () => {
    const log = new Logger();
    expect(log.constructor.name).to.equal('DerivedLogger')
  });

  it("should have a custom Console transport", () => {
    const log = new Logger();
    expect(log.transports[0].constructor.name).to.equal('CustomConsole')
  });

  describe('CustomConsole', () => {
    it('should have max listeners set', () => {
      const log = new Logger();
      const transporter = log.transports[0]
      expect(transporter._maxListeners).to.equal(30)
    })

    it('should have an overridden log method', () => {
      const log = new Logger();
      const transporter = log.transports[0]
      expect(typeof transporter.log).to.equal('function')
    })
  });

  describe('Log Level', function () {
    describe('when level is debug', () => {
      let consoleSpy;

      beforeEach(() => {
        // This overrides console.log locally too. If you need to
        // debug statements here, switch to console.warn.
        consoleSpy = sinon.stub(console, 'log');
      });

      afterEach(() => {
        consoleSpy.restore();
      })

      it('should print error statements', () => {
        const log = new Logger();
        const transporter = log.transports[0]

        log.error('test error')

        const args = consoleSpy.getCall(-1).args
        expect(args).to.include('test error');
        expect(args).to.include(`color: ${transporter.levelColors.ERROR};`);
      });

      it('should print debug statements', () => {
        const log = new Logger();
        const transporter = log.transports[0]

        log.debug('test debug')

        const args = consoleSpy.getCall(-1).args
        expect(args).to.include('test debug');
        expect(args).to.include(`color: ${transporter.levelColors.DEBUG};`);
      });
    });
    describe('when level is production', () => {
      let consoleSpy;

      beforeEach(() => {
        // This overrides console.log locally too. If you need to
        // debug statements here, switch to console.warn.
        consoleSpy = sinon.stub(console, 'log');
      });

      afterEach(() => {
        consoleSpy.restore();
      })

      it('should print error statements', () => {
        const log = new Logger('error');
        const transporter = log.transports[0]

        log.error('test error')

        const args = consoleSpy.getCall(-1).args
        expect(args).to.include('test error');
        expect(args).to.include(`color: ${transporter.levelColors.ERROR};`);
      });

      it('should NOT print debug statements', () => {
        const log = new Logger('error');
        const transporter = log.transports[0]

        log.debug('test debug')

        expect(consoleSpy).to.not.be.called;
      });
    });
  });
});