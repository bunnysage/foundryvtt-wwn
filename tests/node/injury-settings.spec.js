import { describe, it } from "mocha";
import { expect } from "chai";
import { registerSettings } from "../../module/settings.js";

describe("threshold injury settings", () => {
  it("registers thresholdInjuries as a disabled world setting", () => {
    const registered = {};
    const previousGame = globalThis.game;
    globalThis.game = {
      i18n: { localize: (key) => key },
      settings: {
        register: (namespace, key, config) => {
          registered[`${namespace}.${key}`] = config;
        },
      },
    };

    try {
      registerSettings();
    } finally {
      globalThis.game = previousGame;
    }

    expect(registered["wwn.thresholdInjuries"]).to.include({
      default: false,
      scope: "world",
      type: Boolean,
      config: true,
    });
  });
});

