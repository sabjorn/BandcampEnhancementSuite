import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { assert, expect } from "chai";
import chrome from "sinon-chrome";
chai.use(sinonChai);

import ConfigBackend from "../src/background/config_backend.js";

describe("ConfigBackend", () => {
  let cb;
  let sandbox;

  const dbStub = { get: sinon.stub(), put: sinon.spy() };
  const fakeDefaultConfig = { something: true, value: 123 };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    cb = new ConfigBackend();

    sinon.stub(cb.dbUtils, "getDB").resolves(dbStub);
    cb.defaultConfig = fakeDefaultConfig;
    cb.log = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("init()", () => {
    beforeEach(() => {
      global.chrome = chrome;
    });

    it("should call chrome.runtime.onConnect when correct port name", () => {
      cb.init();
      expect(chrome.runtime.onConnect.addListener).to.be.calledWith(
        cb.connectionListenerCallback
      );
    });
  });

  describe("connectionListenerCallback()", () => {
    const port = {
      name: "",
      onMessage: { addListener: sinon.spy() }
    };

    beforeEach(() => {
      global.chrome = chrome;
    });

    it("will not attach listener to port if incorrect port name", () => {
      port.name = "not the right name";

      cb.connectionListenerCallback(port);

      expect(cb.port).to.not.equal(port);
      expect(port.onMessage.addListener).to.not.be.called;
    });

    it("will attach listener to port if incorrect port name", () => {
      port.name = "bandcamplabelview";

      cb.connectionListenerCallback(port);

      expect(cb.port).to.equal(port);
      expect(port.onMessage.addListener).to.be.calledWith(
        cb.portListenerCallback
      );
    });
  });

  describe("portListenerCallback()", () => {
    beforeEach(() => {
      cb.setupDB = sinon.spy();
      cb.synchronizeConfig = sinon.spy();
      cb.toggleWaveformDisplay = sinon.spy();
      cb.broadcastConfig = sinon.spy();
    });

    it("creates a db handle", () => {
      const msg = { config: {} };
      return cb.portListenerCallback(msg).then(() => {
        expect(cb.dbUtils.getDB).to.be.called;
      });
    });

    it("calls setupDB method", () => {
      return cb.portListenerCallback({}).then(() => {
        expect(cb.setupDB).to.be.calledWith(sinon.match(dbStub));
      });
    });

    it("will call synchronizeConfig() if msg contains config", () => {
      const msg = { config: {} };
      return cb.portListenerCallback(msg).then(() => {
        expect(cb.synchronizeConfig).to.be.calledWith(dbStub, msg.config);
        expect(cb.toggleWaveformDisplay).to.not.be.called;
        expect(cb.broadcastConfig).to.not.be.called;
      });
    });

    it("will call toggleWaveformDisplay() if msg contains toggleWaveformDisplay", () => {
      const msg = { toggleWaveformDisplay: {} };
      return cb.portListenerCallback(msg).then(() => {
        expect(cb.synchronizeConfig).to.not.be.called;
        expect(cb.toggleWaveformDisplay).to.be.calledWith(dbStub);
        expect(cb.broadcastConfig).to.not.be.called;
      });
    });

    it("will call broadcastConfig() if msg contains requestConfig", () => {
      const msg = { requestConfig: {} };
      return cb.portListenerCallback(msg).then(() => {
        expect(cb.synchronizeConfig).to.not.be.called;
        expect(cb.toggleWaveformDisplay).to.not.be.called;
        expect(cb.broadcastConfig).to.be.calledWith(dbStub);
      });
    });
  });

  describe("synchronizeConfig()", () => {
    let mergeDataStub;

    beforeEach(() => {
      mergeDataStub = sinon.stub(ConfigBackend, "mergeData");
      cb.port = { postMessage: sinon.spy() };
    });

    afterEach(() => {
      mergeDataStub.restore();
    });

    it("will post most recent data", () => {
      const expectedConfig = { something: true };
      mergeDataStub.returns(expectedConfig);

      return cb.synchronizeConfig(dbStub, {}).then(() => {
        expect(cb.port.postMessage).to.be.calledWith({
          config: expectedConfig
        });
      });
    });

    it("will fill db with config, only updating new data", () => {
      const db_return_config = { one: 1, two: 2 };
      dbStub.get.resolves(db_return_config);

      const merge_returned_config = { three: 3, four: 4 };
      mergeDataStub.returns(merge_returned_config);

      const input_config = { ten: 10, eleven: 11 };
      return cb.synchronizeConfig(dbStub, input_config).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");
        expect(mergeDataStub).to.be.calledWith(
          sinon.match(db_return_config),
          sinon.match(input_config)
        );
        expect(dbStub.put).to.be.calledWith(
          "config",
          sinon.match(merge_returned_config),
          "config"
        );
      });
    });
  });

  describe("toggleWaveformDisplay()", () => {
    beforeEach(() => {
      cb.port = { postMessage: sinon.spy() };
    });

    it("inverts the 'displayWaveform' key in config DB", () => {
      const returnedConfig = { displayWaveform: false };
      dbStub.get.resolves(returnedConfig);

      return cb.toggleWaveformDisplay(dbStub).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");

        const expectedConfig = { displayWaveform: true };
        expect(dbStub.put).to.be.calledWith(
          "config",
          sinon.match(expectedConfig),
          "config"
        );
        expect(cb.port.postMessage).to.be.calledWith({
          config: expectedConfig
        });
      });
    });
  });

  describe("broadcastConfig()", () => {
    it("gets the config from DB and blast it out of the port", () => {
      cb.port = { postMessage: sinon.spy() };

      const returned_config = { one: 1, two: 2, three: 3 };
      dbStub.get.resolves(returned_config);

      return cb.broadcastConfig(dbStub).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");
        expect(cb.port.postMessage).to.be.calledWith({
          config: returned_config
        });
      });
    });
  });

  describe("setupDB()", () => {
    it("writes default config to db if no entry exists", () => {
      dbStub.get.resolves();

      return cb.setupDB(dbStub).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");

        expect(dbStub.put).to.be.calledWith(
          "config",
          sinon.match(fakeDefaultConfig),
          "config"
        );
      });
    });

    it("writes a single value change change to db", () => {
      const validConfig = {
        something: false
      };
      dbStub.get.resolves(validConfig);

      return cb.setupDB(dbStub).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");

        let mergedConfig = fakeDefaultConfig;
        mergedConfig["something"] = false;

        expect(dbStub.put).to.be.calledWith(
          "config",
          sinon.match(mergedConfig),
          "config"
        );
      });
    });

    it("adds new fields to db if config has new fields", () => {
      const validConfig = {
        something_new: 123
      };
      dbStub.get.resolves(validConfig);

      return cb.setupDB(dbStub).then(() => {
        expect(dbStub.get).to.be.calledWith("config", "config");

        const mergedConfig = fakeDefaultConfig;
        mergedConfig["something_new"] = 123;

        expect(dbStub.put).to.be.calledWith(
          "config",
          sinon.match(mergedConfig),
          "config"
        );
      });
    });
  });

  describe("mergeData()", () => {
    it("will combine two config dictionaries with all elements combined", () => {
      const ref_dict = { one: 1, two: 2 };
      const new_dict = { three: 3, four: 4 };

      const merged = ConfigBackend.mergeData(ref_dict, new_dict);
      expect(JSON.stringify(merged)).to.equal(
        JSON.stringify({ one: 1, two: 2, three: 3, four: 4 })
      );
    });

    it("will combine two config dictionaries and overwrite same key with new_dict values", () => {
      const ref_dict = {
        one: 1,
        element: { two: 2, three: 3 },
        four: 4
      };
      const new_dict = {
        one: 11,
        element: { two: 12 }
      };

      const merged = ConfigBackend.mergeData(ref_dict, new_dict);
      expect(JSON.stringify(merged)).to.equal(
        JSON.stringify({ one: 11, element: { two: 12 }, four: 4 })
      );
    });
  });
});
