/* eslint-env node */
'use strict';

const path = require('path');
const VersionChecker = require('ember-cli-version-checker');

function requireTransform(transformName) {
  let plugin = require(transformName);

  plugin = plugin.__esModule ? plugin.default : plugin;

  // adding `baseDir` ensures that broccoli-babel-transpiler does not
  // issue a warning and opt out of caching
  let pluginPath = require.resolve(`${transformName}/package`);
  let pluginBaseDir = path.dirname(pluginPath);
  plugin.baseDir = () => pluginBaseDir;
  plugin._name = transformName;

  return plugin;
}

function hasPlugin(plugins, name) {
  for (let maybePlugin of plugins) {
    let plugin = Array.isArray(maybePlugin) ? maybePlugin[0] : maybePlugin;
    let pluginName = typeof plugin === 'string' ? plugin : plugin.name || plugin._name;

    if (pluginName === name) {
      return true;
    }
  }

  return false;
}

module.exports = {
  name: 'ember-decorators',

  included(parent) {
    this._super.included.apply(this, arguments);

    const host = this._findHost();

    host.project.ui.writeWarnLine(
      'ember-legacy-class-transform: This transform has been deprecated, please switch to ember-legacy-class-shim'
    );

    // Create a root level version checker for checking the Ember version later on
    const emberChecker = new VersionChecker(host).forEmber();

    // Create a parent checker for checking the parent app/addons dependencies (for things like polyfills)
    const babelChecker = new VersionChecker(parent).for('ember-cli-babel', 'npm');

    if (!babelChecker.satisfies('^6.0.0-beta.1')) {
      host.project.ui.writeWarnLine(
        'ember-legacy-class-transform: You are using an unsupported ember-cli-babel version, ' +
        'legacy class transform will not be included automatically'
      );

      this._registeredWithParent = true;
    } else if (emberChecker.isAbove('2.13.0')) {
      if (parent === host) {
        // The transform is being used in an application, and no longer needed
        host.project.ui.writeWarnLine(
          'ember-legacy-class-transform: this transform is not needed for Ember >= 2.13.0'
        );
      }


      this._registeredWithParent = true;
    }

    this.registerTransformWithParent(parent);
  },

  /**
   * Registers the legacy class transform with the parent addon or application.
   *
   * @param {Addon|EmberAddon|EmberApp} parent
   */
  registerTransformWithParent(parent) {
    if (this._registeredWithParent) return;

    const parentOptions = parent.options = parent.options || {};

    // Create babel options if they do not exist
    parentOptions.babel = parentOptions.babel || {};

    // Create and pull off babel plugins
    const plugins = parentOptions.babel.plugins = parentOptions.babel.plugins || [];

    if (!hasPlugin(plugins, 'babel-plugin-ember-legacy-class-constructor')) {
      const EmberLegacyClassConstructor = requireTransform('babel-plugin-ember-legacy-class-constructor');

      plugins.push(EmberLegacyClassConstructor);
    }

    this._registeredWithParent = true;
  },

  _findHost() {
    let current = this;
    let app;

    do {
      app = current.app || app;
    } while (current.parent.parent && (current = current.parent));

    return app;
  }
};
