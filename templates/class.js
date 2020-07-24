// A Template for quickly creating a new class

import Logger from "./logger";

export default class Class {
  constructor() {
    this.log = new Logger();
    
  }

  init() {
    this.log.info("");
  }
}
