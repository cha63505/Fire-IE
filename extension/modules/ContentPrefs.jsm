/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

/**
 * @fileOverview Manages Fire-IE preferences for content processes.
 */

var EXPORTED_SYMBOLS = ["Prefs"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let baseURL = Cc["@fireie.org/fireie/private;1"].getService(Ci.nsIURI);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const prefRoot = "extensions.fireie.";

/**
 * Preferences branch containing Fire-IE preferences.
 * @type nsIPrefBranch
 */
let branch = Services.prefs.getBranch(prefRoot);

/**
 * List of listeners to be notified whenever preferences are updated
 * @type Array of Function
 */
let listeners = [];

/**
 * This object allows easy access to Fire-IE's preferences, all defined
 * preferences will be available as its members.
 * @class
 */
var Prefs =
{
  /**
   * Called on module startup.
   */
  startup: function()
  {
    // Initialize prefs list
    let defaultBranch = this.defaultBranch;
    for each (let name in defaultBranch.getChildList("", {}))
    {
      let type = defaultBranch.getPrefType(name);
      switch (type)
      {
        case Ci.nsIPrefBranch.PREF_INT:
          defineIntegerProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_BOOL:
          defineBooleanProperty(name);
          break;
        case Ci.nsIPrefBranch.PREF_STRING:
          defineStringProperty(name);
          break;
      }
      if ("_update_" + name in PrefsPrivate)
        PrefsPrivate["_update_" + name]();
    }
  
    // Register observers
    registerObservers();
  },

  /**
   * Retrieves the preferences branch containing default preference values.
   */
  get defaultBranch() /**nsIPreferenceBranch*/
  {
    return Services.prefs.getDefaultBranch(prefRoot);
  },

  /**
   * Called on module shutdown.
   */
  shutdown: function()
  {
  },

  /**
   * Adds a preferences listener that will be fired whenever preferences are
   * reloaded
   */
  addListener: function(/**Function*/ listener)
  {
    let index = listeners.indexOf(listener);
    if (index < 0)
      listeners.push(listener);
  },
  /**
   * Removes a preferences listener
   */
  removeListener: function(/**Function*/ listener)
  {
    let index = listeners.indexOf(listener);
    if (index >= 0)
      listeners.splice(index, 1);
  },
};

/**
 * Private nsIObserver implementation
 * @class
 */
var PrefsPrivate =
{
  /**
   * If set to true notifications about preference changes will no longer cause
   * a reload. This is to prevent unnecessary reloads while saving.
   * @type Boolean
   */
  ignorePrefChanges: false,

  /**
   * nsIObserver implementation
   */
  observe: function(subject, topic, data)
  {
    if (topic == "nsPref:changed" && !this.ignorePrefChanges && "_update_" + data in PrefsPrivate)
      PrefsPrivate["_update_" + data]();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
}

/**
 * Adds observers to keep various properties of Prefs object updated.
 */
function registerObservers()
{
  // Observe preferences changes
  try
  {
    branch.addObserver("", PrefsPrivate, true);
  }
  catch (e)
  {
    Cu.reportError(e);
  }
}

/**
 * Triggers preference listeners whenever a preference is changed.
 */
function triggerListeners(/**String*/ name)
{
  for each (let listener in listeners)
    listener(name);
}

/**
 * Sets up getter/setter on Prefs object for preference.
 */
function defineProperty(/**String*/ name, defaultValue, /**Function*/ readFunc, /**Function*/ writeFunc)
{
  let value = defaultValue;
  PrefsPrivate["_update_" + name] = function()
  {
    try
    {
      value = readFunc();
      triggerListeners(name);
    }
    catch(e)
    {
      Cu.reportError(e);
    }
  }
  Object.defineProperty(Prefs, name, {
    get: function() value,
    set: function(newValue)
    {
      if (value == newValue)
        return value;

      try
      {
        PrefsPrivate.ignorePrefChanges = true;
        writeFunc(newValue);
        value = newValue;
        triggerListeners(name);
      }
      catch(e)
      {
        Cu.reportError(e);
      }
      finally
      {
        PrefsPrivate.ignorePrefChanges = false;
      }
      return value;
    },
    enumerable: true,
    configurable: true
  });
}

/**
 * Sets up getter/setter on Prefs object for an integer preference.
 */
function defineIntegerProperty(/**String*/ name)
{
  defineProperty(name, 0, function() branch.getIntPref(name),
                          function(newValue) branch.setIntPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a boolean preference.
 */
function defineBooleanProperty(/**String*/ name)
{
  defineProperty(name, false, function() branch.getBoolPref(name),
                              function(newValue) branch.setBoolPref(name, newValue));
}

/**
 * Sets up getter/setter on Prefs object for a string preference.
 */
function defineStringProperty(/**String*/ name)
{
  defineProperty(name, "", function() branch.getComplexValue(name, Ci.nsISupportsString).data,
    function(newValue)
    {
      let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      str.data = newValue;
      branch.setComplexValue(name, Ci.nsISupportsString, str);
    });
}

Prefs.startup();
