var solidClientAuthentication;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/ClientAuthentication.ts":
/*!*************************************!*\
  !*** ./src/ClientAuthentication.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const universal_fetch_1 = __webpack_require__(/*! @inrupt/universal-fetch */ "./node_modules/@inrupt/universal-fetch/dist/index-browser.js");
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
const globalFetch = (request, init) => (0, universal_fetch_1.fetch)(request, init);
class ClientAuthentication {
    constructor(loginHandler, redirectHandler, logoutHandler, sessionInfoManager, issuerConfigFetcher) {
        this.loginHandler = loginHandler;
        this.redirectHandler = redirectHandler;
        this.logoutHandler = logoutHandler;
        this.sessionInfoManager = sessionInfoManager;
        this.issuerConfigFetcher = issuerConfigFetcher;
        this.login = async (options, eventEmitter) => {
            var _a, _b;
            await this.sessionInfoManager.clear(options.sessionId);
            const redirectUrl = (_a = options.redirectUrl) !== null && _a !== void 0 ? _a : (0, oidc_client_ext_1.removeOidcQueryParam)(window.location.href);
            if (!(0, solid_client_authn_core_1.isValidRedirectUrl)(redirectUrl)) {
                throw new Error(`${redirectUrl} is not a valid redirect URL, it is either a malformed IRI or it includes a hash fragment.`);
            }
            await this.loginHandler.handle({
                ...options,
                redirectUrl,
                clientName: (_b = options.clientName) !== null && _b !== void 0 ? _b : options.clientId,
                eventEmitter,
            });
        };
        this.fetch = globalFetch;
        this.logout = async (sessionId) => {
            await this.logoutHandler.handle(sessionId);
            this.fetch = globalFetch;
        };
        this.getSessionInfo = async (sessionId) => {
            return this.sessionInfoManager.get(sessionId);
        };
        this.getAllSessionInfo = async () => {
            return this.sessionInfoManager.getAll();
        };
        this.validateCurrentSession = async (currentSessionId) => {
            const sessionInfo = await this.sessionInfoManager.get(currentSessionId);
            if (sessionInfo === undefined ||
                sessionInfo.clientAppId === undefined ||
                sessionInfo.issuer === undefined) {
                return null;
            }
            return sessionInfo;
        };
        this.handleIncomingRedirect = async (url, eventEmitter, tokens) => {
            try {
                const redirectInfo = await this.redirectHandler.handle(url, eventEmitter, tokens);
                this.fetch = redirectInfo.fetch.bind(window);
                this.cleanUrlAfterRedirect(url);
                return {
                    isLoggedIn: redirectInfo.isLoggedIn,
                    webId: redirectInfo.webId,
                    sessionId: redirectInfo.sessionId,
                    expirationDate: redirectInfo.expirationDate,
                    tokens: redirectInfo.tokens,
                };
            }
            catch (err) {
                this.cleanUrlAfterRedirect(url);
                eventEmitter.emit(solid_client_authn_core_1.EVENTS.ERROR, "redirect", err);
                return undefined;
            }
        };
    }
    cleanUrlAfterRedirect(url) {
        const cleanedUpUrl = new URL(url);
        cleanedUpUrl.searchParams.delete("state");
        cleanedUpUrl.searchParams.delete("code");
        cleanedUpUrl.searchParams.delete("id_token");
        cleanedUpUrl.searchParams.delete("access_token");
        cleanedUpUrl.searchParams.delete("error");
        cleanedUpUrl.searchParams.delete("error_description");
        cleanedUpUrl.searchParams.delete("iss");
        try {
            window.history.replaceState(null, "", cleanedUpUrl.toString());
        }
        catch (e) {
        }
    }
}
exports["default"] = ClientAuthentication;


/***/ }),

/***/ "./src/Session.ts":
/*!************************!*\
  !*** ./src/Session.ts ***!
  \************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Session = exports.silentlyAuthenticate = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const uuid_1 = __webpack_require__(/*! uuid */ "./node_modules/uuid/dist/commonjs-browser/index.js");
const events_1 = __importDefault(__webpack_require__(/*! events */ "./node_modules/events/events.js"));
const dependencies_1 = __webpack_require__(/*! ./dependencies */ "./src/dependencies.ts");
const constant_1 = __webpack_require__(/*! ./constant */ "./src/constant.ts");
async function silentlyAuthenticate(sessionId, clientAuthn, session) {
    var _a;
    const storedSessionInfo = await clientAuthn.validateCurrentSession(sessionId);
    if (storedSessionInfo !== null) {
        if (window.localStorage !== null) {
            window.localStorage.setItem(constant_1.KEY_CURRENT_URL, window.location.href);
        }
        else {
            window.sessionStorage.setItem(constant_1.KEY_CURRENT_URL, window.location.href);
        }
        await clientAuthn.login({
            sessionId,
            prompt: "none",
            oidcIssuer: storedSessionInfo.issuer,
            redirectUrl: storedSessionInfo.redirectUrl,
            clientId: storedSessionInfo.clientAppId,
            clientSecret: storedSessionInfo.clientAppSecret,
            tokenType: (_a = storedSessionInfo.tokenType) !== null && _a !== void 0 ? _a : "DPoP",
        }, session.events);
        return true;
    }
    return false;
}
exports.silentlyAuthenticate = silentlyAuthenticate;
function isLoggedIn(sessionInfo) {
    return !!(sessionInfo === null || sessionInfo === void 0 ? void 0 : sessionInfo.isLoggedIn);
}
class Session extends events_1.default {
    constructor(sessionOptions = {}, sessionId = undefined) {
        super();
        this.tokenRequestInProgress = false;
        this.login = async (options) => {
            var _a;
            await this.clientAuthentication.login({
                sessionId: this.info.sessionId,
                ...options,
                tokenType: (_a = options.tokenType) !== null && _a !== void 0 ? _a : "DPoP",
            }, this.events);
            return new Promise(() => { });
        };
        this.fetch = async (url, init) => {
            return this.clientAuthentication.fetch(url, init);
        };
        this.internalLogout = async (emitSignal) => {
            if (window.localStorage !== null) {
                window.localStorage.removeItem(constant_1.KEY_CURRENT_SESSION);
            }
            else {
                window.sessionStorage.removeItem(constant_1.KEY_CURRENT_SESSION);
            }
            await this.clientAuthentication.logout(this.info.sessionId);
            this.info.isLoggedIn = false;
            if (emitSignal) {
                this.events.emit(solid_client_authn_core_1.EVENTS.LOGOUT);
            }
        };
        this.logout = async () => this.internalLogout(true);
        this.handleIncomingRedirect = async (inputOptions = {}) => {
            var _a;
            if (this.info.isLoggedIn) {
                return this.info;
            }
            if (this.tokenRequestInProgress) {
                return undefined;
            }
            const options = typeof inputOptions === "string" ? { url: inputOptions } : inputOptions;
            const url = (_a = options.url) !== null && _a !== void 0 ? _a : window.location.href;
            const { tokens } = options;
            this.tokenRequestInProgress = true;
            const sessionInfo = await this.clientAuthentication.handleIncomingRedirect(url, this.events, tokens);
            if (isLoggedIn(sessionInfo)) {
                this.setSessionInfo(sessionInfo);
                const currentUrl = window.localStorage
                    ? window.localStorage.getItem(constant_1.KEY_CURRENT_URL)
                    : window.sessionStorage.getItem(constant_1.KEY_CURRENT_URL);
                if (currentUrl === null) {
                    this.events.emit(solid_client_authn_core_1.EVENTS.LOGIN);
                }
                else {
                    if (window.localStorage !== null) {
                        window.localStorage.removeItem(constant_1.KEY_CURRENT_URL);
                    }
                    else {
                        window.sessionStorage.removeItem(constant_1.KEY_CURRENT_URL);
                    }
                    this.events.emit(solid_client_authn_core_1.EVENTS.SESSION_RESTORED, currentUrl);
                }
            }
            else if (options.restorePreviousSession === true) {
                const storedSessionId = window.localStorage
                    ? window.localStorage.getItem(constant_1.KEY_CURRENT_SESSION)
                    : window.sessionStorage.getItem(constant_1.KEY_CURRENT_SESSION);
                if (storedSessionId !== null) {
                    const attemptedSilentAuthentication = await silentlyAuthenticate(storedSessionId, this.clientAuthentication, this);
                    if (attemptedSilentAuthentication) {
                        return new Promise(() => { });
                    }
                }
            }
            this.tokenRequestInProgress = false;
            return sessionInfo;
        };
        this.events = new Proxy(this, (0, solid_client_authn_core_1.buildProxyHandler)(Session.prototype, "events only implements ISessionEventListener"));
        if (sessionOptions.clientAuthentication) {
            this.clientAuthentication = sessionOptions.clientAuthentication;
        }
        else if (sessionOptions.secureStorage && sessionOptions.insecureStorage) {
            this.clientAuthentication = (0, dependencies_1.getClientAuthenticationWithDependencies)({
                secureStorage: sessionOptions.secureStorage,
                insecureStorage: sessionOptions.insecureStorage,
            });
        }
        else {
            this.clientAuthentication = (0, dependencies_1.getClientAuthenticationWithDependencies)({});
        }
        if (sessionOptions.sessionInfo) {
            this.info = {
                sessionId: sessionOptions.sessionInfo.sessionId,
                isLoggedIn: false,
                webId: sessionOptions.sessionInfo.webId,
            };
        }
        else {
            this.info = {
                sessionId: sessionId !== null && sessionId !== void 0 ? sessionId : (0, uuid_1.v4)(),
                isLoggedIn: false,
            };
        }
        this.events.on(solid_client_authn_core_1.EVENTS.LOGIN, () => {
            if (window.localStorage !== null)
                window.localStorage.setItem(constant_1.KEY_CURRENT_SESSION, this.info.sessionId);
            else
                window.sessionStorage.setItem(constant_1.KEY_CURRENT_SESSION, this.info.sessionId);
        });
        this.events.on(solid_client_authn_core_1.EVENTS.SESSION_EXPIRED, () => this.internalLogout(false));
        this.events.on(solid_client_authn_core_1.EVENTS.ERROR, () => this.internalLogout(false));
    }
    onLogin(callback) {
        this.events.on(solid_client_authn_core_1.EVENTS.LOGIN, callback);
    }
    onLogout(callback) {
        this.events.on(solid_client_authn_core_1.EVENTS.LOGOUT, callback);
    }
    onError(callback) {
        this.events.on(solid_client_authn_core_1.EVENTS.ERROR, callback);
    }
    onSessionRestore(callback) {
        this.events.on(solid_client_authn_core_1.EVENTS.SESSION_RESTORED, callback);
    }
    onSessionExpiration(callback) {
        this.events.on(solid_client_authn_core_1.EVENTS.SESSION_EXPIRED, callback);
    }
    setSessionInfo(sessionInfo) {
        this.info.isLoggedIn = sessionInfo.isLoggedIn;
        this.info.webId = sessionInfo.webId;
        this.info.sessionId = sessionInfo.sessionId;
        this.info.expirationDate = sessionInfo.expirationDate;
        this.events.on(solid_client_authn_core_1.EVENTS.SESSION_EXTENDED, (expiresIn) => {
            this.info.expirationDate = Date.now() + expiresIn * 1000;
        });
    }
}
exports.Session = Session;


/***/ }),

/***/ "./src/constant.ts":
/*!*************************!*\
  !*** ./src/constant.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.KEY_CURRENT_URL = exports.KEY_CURRENT_SESSION = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
exports.KEY_CURRENT_SESSION = `${solid_client_authn_core_1.SOLID_CLIENT_AUTHN_KEY_PREFIX}currentSession`;
exports.KEY_CURRENT_URL = `${solid_client_authn_core_1.SOLID_CLIENT_AUTHN_KEY_PREFIX}currentUrl`;


/***/ }),

/***/ "./src/defaultSession.ts":
/*!*******************************!*\
  !*** ./src/defaultSession.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.events = exports.onSessionRestore = exports.onLogout = exports.onLogin = exports.handleIncomingRedirect = exports.logout = exports.login = exports.fetch = exports.getDefaultSession = void 0;
const Session_1 = __webpack_require__(/*! ./Session */ "./src/Session.ts");
let defaultSession;
function getDefaultSession() {
    if (typeof defaultSession === "undefined") {
        defaultSession = new Session_1.Session();
    }
    return defaultSession;
}
exports.getDefaultSession = getDefaultSession;
const fetch = (...args) => {
    const session = getDefaultSession();
    return session.fetch(...args);
};
exports.fetch = fetch;
const login = (...args) => {
    const session = getDefaultSession();
    return session.login(...args);
};
exports.login = login;
const logout = (...args) => {
    const session = getDefaultSession();
    return session.logout(...args);
};
exports.logout = logout;
const handleIncomingRedirect = (...args) => {
    const session = getDefaultSession();
    return session.handleIncomingRedirect(...args);
};
exports.handleIncomingRedirect = handleIncomingRedirect;
const onLogin = (...args) => {
    const session = getDefaultSession();
    return session.onLogin(...args);
};
exports.onLogin = onLogin;
const onLogout = (...args) => {
    const session = getDefaultSession();
    return session.onLogout(...args);
};
exports.onLogout = onLogout;
const onSessionRestore = (...args) => {
    const session = getDefaultSession();
    return session.onSessionRestore(...args);
};
exports.onSessionRestore = onSessionRestore;
const events = () => {
    return getDefaultSession().events;
};
exports.events = events;


/***/ }),

/***/ "./src/dependencies.ts":
/*!*****************************!*\
  !*** ./src/dependencies.ts ***!
  \*****************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getClientAuthenticationWithDependencies = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const StorageUtility_1 = __importDefault(__webpack_require__(/*! ./storage/StorageUtility */ "./src/storage/StorageUtility.ts"));
const ClientAuthentication_1 = __importDefault(__webpack_require__(/*! ./ClientAuthentication */ "./src/ClientAuthentication.ts"));
const OidcLoginHandler_1 = __importDefault(__webpack_require__(/*! ./login/oidc/OidcLoginHandler */ "./src/login/oidc/OidcLoginHandler.ts"));
const AuthorizationCodeWithPkceOidcHandler_1 = __importDefault(__webpack_require__(/*! ./login/oidc/oidcHandlers/AuthorizationCodeWithPkceOidcHandler */ "./src/login/oidc/oidcHandlers/AuthorizationCodeWithPkceOidcHandler.ts"));
const IssuerConfigFetcher_1 = __importDefault(__webpack_require__(/*! ./login/oidc/IssuerConfigFetcher */ "./src/login/oidc/IssuerConfigFetcher.ts"));
const FallbackRedirectHandler_1 = __webpack_require__(/*! ./login/oidc/incomingRedirectHandler/FallbackRedirectHandler */ "./src/login/oidc/incomingRedirectHandler/FallbackRedirectHandler.ts");
const GeneralLogoutHandler_1 = __importDefault(__webpack_require__(/*! ./logout/GeneralLogoutHandler */ "./src/logout/GeneralLogoutHandler.ts"));
const SessionInfoManager_1 = __webpack_require__(/*! ./sessionInfo/SessionInfoManager */ "./src/sessionInfo/SessionInfoManager.ts");
const AuthCodeRedirectHandler_1 = __webpack_require__(/*! ./login/oidc/incomingRedirectHandler/AuthCodeRedirectHandler */ "./src/login/oidc/incomingRedirectHandler/AuthCodeRedirectHandler.ts");
const AggregateRedirectHandler_1 = __importDefault(__webpack_require__(/*! ./login/oidc/AggregateRedirectHandler */ "./src/login/oidc/AggregateRedirectHandler.ts"));
const BrowserStorage_1 = __importDefault(__webpack_require__(/*! ./storage/BrowserStorage */ "./src/storage/BrowserStorage.ts"));
const Redirector_1 = __importDefault(__webpack_require__(/*! ./login/oidc/Redirector */ "./src/login/oidc/Redirector.ts"));
const ClientRegistrar_1 = __importDefault(__webpack_require__(/*! ./login/oidc/ClientRegistrar */ "./src/login/oidc/ClientRegistrar.ts"));
const ErrorOidcHandler_1 = __webpack_require__(/*! ./login/oidc/incomingRedirectHandler/ErrorOidcHandler */ "./src/login/oidc/incomingRedirectHandler/ErrorOidcHandler.ts");
const TokenRefresher_1 = __importDefault(__webpack_require__(/*! ./login/oidc/refresh/TokenRefresher */ "./src/login/oidc/refresh/TokenRefresher.ts"));
function getClientAuthenticationWithDependencies(dependencies) {
    const inMemoryStorage = new solid_client_authn_core_1.InMemoryStorage();
    const secureStorage = dependencies.secureStorage || inMemoryStorage;
    const insecureStorage = dependencies.insecureStorage || new BrowserStorage_1.default();
    const storageUtility = new StorageUtility_1.default(secureStorage, insecureStorage);
    const issuerConfigFetcher = new IssuerConfigFetcher_1.default(storageUtility);
    const clientRegistrar = new ClientRegistrar_1.default(storageUtility);
    const sessionInfoManager = new SessionInfoManager_1.SessionInfoManager(storageUtility);
    const tokenRefresher = new TokenRefresher_1.default(storageUtility, issuerConfigFetcher, clientRegistrar);
    const loginHandler = new OidcLoginHandler_1.default(storageUtility, new AuthorizationCodeWithPkceOidcHandler_1.default(storageUtility, new Redirector_1.default()), issuerConfigFetcher, clientRegistrar);
    const redirectHandler = new AggregateRedirectHandler_1.default([
        new ErrorOidcHandler_1.ErrorOidcHandler(),
        new AuthCodeRedirectHandler_1.AuthCodeRedirectHandler(storageUtility, sessionInfoManager, issuerConfigFetcher, clientRegistrar, tokenRefresher),
        new FallbackRedirectHandler_1.FallbackRedirectHandler(),
    ]);
    return new ClientAuthentication_1.default(loginHandler, redirectHandler, new GeneralLogoutHandler_1.default(sessionInfoManager), sessionInfoManager, issuerConfigFetcher);
}
exports.getClientAuthenticationWithDependencies = getClientAuthenticationWithDependencies;


/***/ }),

/***/ "./src/index.browser.ts":
/*!******************************!*\
  !*** ./src/index.browser.ts ***!
  \******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const solidClientAuthentication = __importStar(__webpack_require__(/*! ./index */ "./src/index.ts"));
exports["default"] = solidClientAuthentication;


/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EVENTS = exports.InMemoryStorage = exports.ConfigurationError = exports.NotImplementedError = exports.getClientAuthenticationWithDependencies = exports.Session = void 0;
var Session_1 = __webpack_require__(/*! ./Session */ "./src/Session.ts");
Object.defineProperty(exports, "Session", ({ enumerable: true, get: function () { return Session_1.Session; } }));
var dependencies_1 = __webpack_require__(/*! ./dependencies */ "./src/dependencies.ts");
Object.defineProperty(exports, "getClientAuthenticationWithDependencies", ({ enumerable: true, get: function () { return dependencies_1.getClientAuthenticationWithDependencies; } }));
__exportStar(__webpack_require__(/*! ./defaultSession */ "./src/defaultSession.ts"), exports);
var solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
Object.defineProperty(exports, "NotImplementedError", ({ enumerable: true, get: function () { return solid_client_authn_core_1.NotImplementedError; } }));
Object.defineProperty(exports, "ConfigurationError", ({ enumerable: true, get: function () { return solid_client_authn_core_1.ConfigurationError; } }));
Object.defineProperty(exports, "InMemoryStorage", ({ enumerable: true, get: function () { return solid_client_authn_core_1.InMemoryStorage; } }));
Object.defineProperty(exports, "EVENTS", ({ enumerable: true, get: function () { return solid_client_authn_core_1.EVENTS; } }));


/***/ }),

/***/ "./src/login/oidc/AggregateRedirectHandler.ts":
/*!****************************************************!*\
  !*** ./src/login/oidc/AggregateRedirectHandler.ts ***!
  \****************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
class AggregateRedirectHandler extends solid_client_authn_core_1.AggregateHandler {
    constructor(redirectHandlers) {
        super(redirectHandlers);
    }
}
exports["default"] = AggregateRedirectHandler;


/***/ }),

/***/ "./src/login/oidc/ClientRegistrar.ts":
/*!*******************************************!*\
  !*** ./src/login/oidc/ClientRegistrar.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
class ClientRegistrar {
    constructor(storageUtility) {
        this.storageUtility = storageUtility;
    }
    async getClient(options, issuerConfig) {
        const [storedClientId, storedClientSecret,] = await Promise.all([
            this.storageUtility.getForUser(options.sessionId, "clientId", {
                secure: false,
            }),
            this.storageUtility.getForUser(options.sessionId, "clientSecret", {
                secure: false,
            }),
        ]);
        if (storedClientId) {
            return {
                clientId: storedClientId,
                clientSecret: storedClientSecret,
                clientType: "dynamic",
            };
        }
        try {
            const registeredClient = await (0, oidc_client_ext_1.registerClient)(options, issuerConfig);
            const infoToSave = {
                clientId: registeredClient.clientId,
            };
            if (registeredClient.clientSecret) {
                infoToSave.clientSecret = registeredClient.clientSecret;
            }
            if (registeredClient.idTokenSignedResponseAlg) {
                infoToSave.idTokenSignedResponseAlg =
                    registeredClient.idTokenSignedResponseAlg;
            }
            await this.storageUtility.setForUser(options.sessionId, infoToSave, {
                secure: false,
            });
            return registeredClient;
        }
        catch (error) {
            throw new Error(`Client registration failed: [${error}]`);
        }
    }
}
exports["default"] = ClientRegistrar;


/***/ }),

/***/ "./src/login/oidc/IssuerConfigFetcher.ts":
/*!***********************************************!*\
  !*** ./src/login/oidc/IssuerConfigFetcher.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WELL_KNOWN_OPENID_CONFIG = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const universal_fetch_1 = __webpack_require__(/*! @inrupt/universal-fetch */ "./node_modules/@inrupt/universal-fetch/dist/index-browser.js");
exports.WELL_KNOWN_OPENID_CONFIG = ".well-known/openid-configuration";
const issuerConfigKeyMap = {
    issuer: {
        toKey: "issuer",
        convertToUrl: true,
    },
    authorization_endpoint: {
        toKey: "authorizationEndpoint",
        convertToUrl: true,
    },
    token_endpoint: {
        toKey: "tokenEndpoint",
        convertToUrl: true,
    },
    userinfo_endpoint: {
        toKey: "userinfoEndpoint",
        convertToUrl: true,
    },
    jwks_uri: {
        toKey: "jwksUri",
        convertToUrl: true,
    },
    registration_endpoint: {
        toKey: "registrationEndpoint",
        convertToUrl: true,
    },
    scopes_supported: { toKey: "scopesSupported" },
    response_types_supported: { toKey: "responseTypesSupported" },
    response_modes_supported: { toKey: "responseModesSupported" },
    grant_types_supported: { toKey: "grantTypesSupported" },
    acr_values_supported: { toKey: "acrValuesSupported" },
    subject_types_supported: { toKey: "subjectTypesSupported" },
    id_token_signing_alg_values_supported: {
        toKey: "idTokenSigningAlgValuesSupported",
    },
    id_token_encryption_alg_values_supported: {
        toKey: "idTokenEncryptionAlgValuesSupported",
    },
    id_token_encryption_enc_values_supported: {
        toKey: "idTokenEncryptionEncValuesSupported",
    },
    userinfo_signing_alg_values_supported: {
        toKey: "userinfoSigningAlgValuesSupported",
    },
    userinfo_encryption_alg_values_supported: {
        toKey: "userinfoEncryptionAlgValuesSupported",
    },
    userinfo_encryption_enc_values_supported: {
        toKey: "userinfoEncryptionEncValuesSupported",
    },
    request_object_signing_alg_values_supported: {
        toKey: "requestObjectSigningAlgValuesSupported",
    },
    request_object_encryption_alg_values_supported: {
        toKey: "requestObjectEncryptionAlgValuesSupported",
    },
    request_object_encryption_enc_values_supported: {
        toKey: "requestObjectEncryptionEncValuesSupported",
    },
    token_endpoint_auth_methods_supported: {
        toKey: "tokenEndpointAuthMethodsSupported",
    },
    token_endpoint_auth_signing_alg_values_supported: {
        toKey: "tokenEndpointAuthSigningAlgValuesSupported",
    },
    display_values_supported: { toKey: "displayValuesSupported" },
    claim_types_supported: { toKey: "claimTypesSupported" },
    claims_supported: { toKey: "claimsSupported" },
    service_documentation: { toKey: "serviceDocumentation" },
    claims_locales_supported: { toKey: "claimsLocalesSupported" },
    ui_locales_supported: { toKey: "uiLocalesSupported" },
    claims_parameter_supported: { toKey: "claimsParameterSupported" },
    request_parameter_supported: { toKey: "requestParameterSupported" },
    request_uri_parameter_supported: { toKey: "requestUriParameterSupported" },
    require_request_uri_registration: { toKey: "requireRequestUriRegistration" },
    op_policy_uri: {
        toKey: "opPolicyUri",
        convertToUrl: true,
    },
    op_tos_uri: {
        toKey: "opTosUri",
        convertToUrl: true,
    },
};
function processConfig(config) {
    const parsedConfig = {};
    Object.keys(config).forEach((key) => {
        if (issuerConfigKeyMap[key]) {
            parsedConfig[issuerConfigKeyMap[key].toKey] = config[key];
        }
    });
    if (!Array.isArray(parsedConfig.scopesSupported)) {
        parsedConfig.scopesSupported = ["openid"];
    }
    return parsedConfig;
}
class IssuerConfigFetcher {
    constructor(storageUtility) {
        this.storageUtility = storageUtility;
    }
    static getLocalStorageKey(issuer) {
        return `issuerConfig:${issuer}`;
    }
    async fetchConfig(issuer) {
        let issuerConfig;
        const openIdConfigUrl = new URL(exports.WELL_KNOWN_OPENID_CONFIG, issuer.endsWith("/") ? issuer : `${issuer}/`).href;
        const issuerConfigRequestBody = await (0, universal_fetch_1.fetch)(openIdConfigUrl);
        try {
            issuerConfig = processConfig(await issuerConfigRequestBody.json());
        }
        catch (err) {
            throw new solid_client_authn_core_1.ConfigurationError(`[${issuer.toString()}] has an invalid configuration: ${err.message}`);
        }
        await this.storageUtility.set(IssuerConfigFetcher.getLocalStorageKey(issuer), JSON.stringify(issuerConfig));
        return issuerConfig;
    }
}
exports["default"] = IssuerConfigFetcher;


/***/ }),

/***/ "./src/login/oidc/OidcLoginHandler.ts":
/*!********************************************!*\
  !*** ./src/login/oidc/OidcLoginHandler.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
function hasIssuer(options) {
    return typeof options.oidcIssuer === "string";
}
function hasRedirectUrl(options) {
    return typeof options.redirectUrl === "string";
}
class OidcLoginHandler {
    constructor(storageUtility, oidcHandler, issuerConfigFetcher, clientRegistrar) {
        this.storageUtility = storageUtility;
        this.oidcHandler = oidcHandler;
        this.issuerConfigFetcher = issuerConfigFetcher;
        this.clientRegistrar = clientRegistrar;
    }
    async canHandle(options) {
        return hasIssuer(options) && hasRedirectUrl(options);
    }
    async handle(options) {
        if (!hasIssuer(options)) {
            throw new solid_client_authn_core_1.ConfigurationError(`OidcLoginHandler requires an OIDC issuer: missing property 'oidcIssuer' in ${JSON.stringify(options)}`);
        }
        if (!hasRedirectUrl(options)) {
            throw new solid_client_authn_core_1.ConfigurationError(`OidcLoginHandler requires a redirect URL: missing property 'redirectUrl' in ${JSON.stringify(options)}`);
        }
        const issuerConfig = await this.issuerConfigFetcher.fetchConfig(options.oidcIssuer);
        const clientRegistration = await (0, solid_client_authn_core_1.handleRegistration)(options, issuerConfig, this.storageUtility, this.clientRegistrar);
        const OidcOptions = {
            issuer: issuerConfig.issuer,
            dpop: options.tokenType.toLowerCase() === "dpop",
            ...options,
            issuerConfiguration: issuerConfig,
            client: clientRegistration,
        };
        return this.oidcHandler.handle(OidcOptions);
    }
}
exports["default"] = OidcLoginHandler;


/***/ }),

/***/ "./src/login/oidc/Redirector.ts":
/*!**************************************!*\
  !*** ./src/login/oidc/Redirector.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class Redirector {
    redirect(redirectUrl, options) {
        if (options && options.handleRedirect) {
            options.handleRedirect(redirectUrl);
        }
        else if (options && options.redirectByReplacingState) {
            try {
                window.history.replaceState({}, "", redirectUrl);
            }
            catch (e) {
            }
        }
        else {
            window.location.href = redirectUrl;
        }
    }
}
exports["default"] = Redirector;


/***/ }),

/***/ "./src/login/oidc/incomingRedirectHandler/AuthCodeRedirectHandler.ts":
/*!***************************************************************************!*\
  !*** ./src/login/oidc/incomingRedirectHandler/AuthCodeRedirectHandler.ts ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthCodeRedirectHandler = void 0;
const universal_fetch_1 = __webpack_require__(/*! @inrupt/universal-fetch */ "./node_modules/@inrupt/universal-fetch/dist/index-browser.js");
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
class AuthCodeRedirectHandler {
    constructor(storageUtility, sessionInfoManager, issuerConfigFetcher, clientRegistrar, tokerRefresher) {
        this.storageUtility = storageUtility;
        this.sessionInfoManager = sessionInfoManager;
        this.issuerConfigFetcher = issuerConfigFetcher;
        this.clientRegistrar = clientRegistrar;
        this.tokerRefresher = tokerRefresher;
    }
    async canHandle(redirectUrl) {
        try {
            const myUrl = new URL(redirectUrl);
            return (myUrl.searchParams.get("code") !== null &&
                myUrl.searchParams.get("state") !== null);
        }
        catch (e) {
            throw new Error(`[${redirectUrl}] is not a valid URL, and cannot be used as a redirect URL: ${e}`);
        }
    }
    async handle(redirectUrl, eventEmitter, storedTokens) {
        if (!(await this.canHandle(redirectUrl))) {
            throw new Error(`AuthCodeRedirectHandler cannot handle [${redirectUrl}]: it is missing one of [code, state].`);
        }
        const url = new URL(redirectUrl);
        const oauthState = url.searchParams.get("state");
        const storedSessionId = (await this.storageUtility.getForUser(oauthState, "sessionId", {
            errorIfNull: true,
        }));
        const { issuerConfig, codeVerifier, redirectUrl: storedRedirectIri, dpop: isDpop, } = await (0, solid_client_authn_core_1.loadOidcContextFromStorage)(storedSessionId, this.storageUtility, this.issuerConfigFetcher);
        const iss = url.searchParams.get("iss");
        if (typeof iss === "string" && iss !== issuerConfig.issuer) {
            throw new Error(`The value of the iss parameter (${iss}) does not match the issuer identifier of the authorization server (${issuerConfig.issuer}). See [rfc9207](https://www.rfc-editor.org/rfc/rfc9207.html#section-2.3-3.1.1)`);
        }
        if (codeVerifier === undefined) {
            throw new Error(`The code verifier for session ${storedSessionId} is missing from storage.`);
        }
        if (storedRedirectIri === undefined) {
            throw new Error(`The redirect URL for session ${storedSessionId} is missing from storage.`);
        }
        const client = await this.clientRegistrar.getClient({ sessionId: storedSessionId }, issuerConfig);
        let tokens;
        const tokenCreatedAt = Date.now();
        if (isDpop) {
            if (storedTokens) {
                tokens = await (0, oidc_client_ext_1.importDpopToken)(storedTokens);
            }
            else {
                tokens = await (0, oidc_client_ext_1.getDpopToken)(issuerConfig, client, {
                    grantType: "authorization_code",
                    code: url.searchParams.get("code"),
                    codeVerifier,
                    redirectUrl: storedRedirectIri,
                });
            }
            if (window.localStorage) {
                window.localStorage.removeItem(`oidc.${oauthState}`);
            }
            else {
                window.sessionStorage.removeItem(`oidc.${oauthState}`);
            }
        }
        else {
            if (storedTokens) {
                tokens = storedTokens;
            }
            else {
                tokens = await (0, oidc_client_ext_1.getBearerToken)(url.toString());
            }
        }
        let refreshOptions;
        if (tokens.refreshToken !== undefined) {
            refreshOptions = {
                sessionId: storedSessionId,
                refreshToken: tokens.refreshToken,
                tokenRefresher: this.tokerRefresher,
            };
        }
        const authFetch = await (0, solid_client_authn_core_1.buildAuthenticatedFetch)(universal_fetch_1.fetch, tokens.accessToken, {
            dpopKey: tokens.dpopKey,
            refreshOptions,
            eventEmitter,
            expiresIn: tokens.expiresIn,
        });
        await this.storageUtility.setForUser(storedSessionId, {
            webId: tokens.webId,
            isLoggedIn: "true",
        }, { secure: true });
        const sessionInfo = await this.sessionInfoManager.get(storedSessionId);
        if (!sessionInfo) {
            throw new Error(`Could not retrieve session: [${storedSessionId}].`);
        }
        return Object.assign(sessionInfo, {
            fetch: authFetch,
            tokens,
            expirationDate: typeof tokens.expiresIn === "number"
                ? tokenCreatedAt + tokens.expiresIn * 1000
                : null,
        });
    }
}
exports.AuthCodeRedirectHandler = AuthCodeRedirectHandler;


/***/ }),

/***/ "./src/login/oidc/incomingRedirectHandler/ErrorOidcHandler.ts":
/*!********************************************************************!*\
  !*** ./src/login/oidc/incomingRedirectHandler/ErrorOidcHandler.ts ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ErrorOidcHandler = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const SessionInfoManager_1 = __webpack_require__(/*! ../../../sessionInfo/SessionInfoManager */ "./src/sessionInfo/SessionInfoManager.ts");
class ErrorOidcHandler {
    async canHandle(redirectUrl) {
        try {
            return new URL(redirectUrl).searchParams.has("error");
        }
        catch (e) {
            throw new Error(`[${redirectUrl}] is not a valid URL, and cannot be used as a redirect URL: ${e}`);
        }
    }
    async handle(redirectUrl, eventEmitter) {
        if (eventEmitter !== undefined) {
            const url = new URL(redirectUrl);
            const errorUrl = url.searchParams.get("error");
            const errorDescriptionUrl = url.searchParams.get("error_description");
            eventEmitter.emit(solid_client_authn_core_1.EVENTS.ERROR, errorUrl, errorDescriptionUrl);
        }
        return (0, SessionInfoManager_1.getUnauthenticatedSession)();
    }
}
exports.ErrorOidcHandler = ErrorOidcHandler;


/***/ }),

/***/ "./src/login/oidc/incomingRedirectHandler/FallbackRedirectHandler.ts":
/*!***************************************************************************!*\
  !*** ./src/login/oidc/incomingRedirectHandler/FallbackRedirectHandler.ts ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FallbackRedirectHandler = void 0;
const SessionInfoManager_1 = __webpack_require__(/*! ../../../sessionInfo/SessionInfoManager */ "./src/sessionInfo/SessionInfoManager.ts");
class FallbackRedirectHandler {
    async canHandle(redirectUrl) {
        try {
            new URL(redirectUrl);
            return true;
        }
        catch (e) {
            throw new Error(`[${redirectUrl}] is not a valid URL, and cannot be used as a redirect URL: ${e}`);
        }
    }
    async handle(_redirectUrl) {
        return (0, SessionInfoManager_1.getUnauthenticatedSession)();
    }
}
exports.FallbackRedirectHandler = FallbackRedirectHandler;


/***/ }),

/***/ "./src/login/oidc/oidcHandlers/AuthorizationCodeWithPkceOidcHandler.ts":
/*!*****************************************************************************!*\
  !*** ./src/login/oidc/oidcHandlers/AuthorizationCodeWithPkceOidcHandler.ts ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
class AuthorizationCodeWithPkceOidcHandler {
    constructor(storageUtility, redirector) {
        this.storageUtility = storageUtility;
        this.redirector = redirector;
    }
    async canHandle(oidcLoginOptions) {
        return !!(oidcLoginOptions.issuerConfiguration.grantTypesSupported &&
            oidcLoginOptions.issuerConfiguration.grantTypesSupported.indexOf("authorization_code") > -1);
    }
    async handle(oidcLoginOptions) {
        var _a;
        const oidcOptions = {
            authority: oidcLoginOptions.issuer.toString(),
            client_id: oidcLoginOptions.client.clientId,
            client_secret: oidcLoginOptions.client.clientSecret,
            redirect_uri: oidcLoginOptions.redirectUrl.toString(),
            post_logout_redirect_uri: oidcLoginOptions.redirectUrl.toString(),
            response_type: "code",
            scope: solid_client_authn_core_1.DEFAULT_SCOPES,
            filterProtocolClaims: true,
            loadUserInfo: false,
            code_verifier: true,
            prompt: (_a = oidcLoginOptions.prompt) !== null && _a !== void 0 ? _a : "consent",
        };
        const oidcClientLibrary = new oidc_client_ext_1.OidcClient(oidcOptions);
        const { redirector } = this;
        const storage = this.storageUtility;
        try {
            const signingRequest = await oidcClientLibrary.createSigninRequest();
            await Promise.all([
                storage.setForUser(signingRequest.state._id, {
                    sessionId: oidcLoginOptions.sessionId,
                }),
                storage.setForUser(oidcLoginOptions.sessionId, {
                    codeVerifier: signingRequest.state._code_verifier,
                    issuer: oidcLoginOptions.issuer.toString(),
                    redirectUrl: oidcLoginOptions.redirectUrl,
                    dpop: oidcLoginOptions.dpop ? "true" : "false",
                }),
            ]);
            redirector.redirect(signingRequest.url.toString(), {
                handleRedirect: oidcLoginOptions.handleRedirect,
            });
        }
        catch (err) {
            console.error(err);
        }
        return undefined;
    }
}
exports["default"] = AuthorizationCodeWithPkceOidcHandler;


/***/ }),

/***/ "./src/login/oidc/refresh/TokenRefresher.ts":
/*!**************************************************!*\
  !*** ./src/login/oidc/refresh/TokenRefresher.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
class TokenRefresher {
    constructor(storageUtility, issuerConfigFetcher, clientRegistrar) {
        this.storageUtility = storageUtility;
        this.issuerConfigFetcher = issuerConfigFetcher;
        this.clientRegistrar = clientRegistrar;
    }
    async refresh(sessionId, refreshToken, dpopKey, eventEmitter) {
        const oidcContext = await (0, solid_client_authn_core_1.loadOidcContextFromStorage)(sessionId, this.storageUtility, this.issuerConfigFetcher);
        const clientInfo = await this.clientRegistrar.getClient({ sessionId }, oidcContext.issuerConfig);
        if (refreshToken === undefined) {
            throw new Error(`Session [${sessionId}] has no refresh token to allow it to refresh its access token.`);
        }
        if (oidcContext.dpop && dpopKey === undefined) {
            throw new Error(`For session [${sessionId}], the key bound to the DPoP access token must be provided to refresh said access token.`);
        }
        const tokenSet = await (0, oidc_client_ext_1.refresh)(refreshToken, oidcContext.issuerConfig, clientInfo, dpopKey);
        if (tokenSet.refreshToken !== undefined) {
            eventEmitter === null || eventEmitter === void 0 ? void 0 : eventEmitter.emit(solid_client_authn_core_1.EVENTS.NEW_REFRESH_TOKEN, tokenSet.refreshToken);
            await this.storageUtility.setForUser(sessionId, {
                refreshToken: tokenSet.refreshToken,
            });
        }
        return tokenSet;
    }
}
exports["default"] = TokenRefresher;


/***/ }),

/***/ "./src/logout/GeneralLogoutHandler.ts":
/*!********************************************!*\
  !*** ./src/logout/GeneralLogoutHandler.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class GeneralLogoutHandler {
    constructor(sessionInfoManager) {
        this.sessionInfoManager = sessionInfoManager;
    }
    async canHandle() {
        return true;
    }
    async handle(userId) {
        await this.sessionInfoManager.clear(userId);
    }
}
exports["default"] = GeneralLogoutHandler;


/***/ }),

/***/ "./src/sessionInfo/SessionInfoManager.ts":
/*!***********************************************!*\
  !*** ./src/sessionInfo/SessionInfoManager.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SessionInfoManager = exports.clear = exports.getUnauthenticatedSession = void 0;
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
const uuid_1 = __webpack_require__(/*! uuid */ "./node_modules/uuid/dist/commonjs-browser/index.js");
const oidc_client_ext_1 = __webpack_require__(/*! @inrupt/oidc-client-ext */ "../oidc-browser/dist/index.es.js");
const universal_fetch_1 = __webpack_require__(/*! @inrupt/universal-fetch */ "./node_modules/@inrupt/universal-fetch/dist/index-browser.js");
function getUnauthenticatedSession() {
    return {
        isLoggedIn: false,
        sessionId: (0, uuid_1.v4)(),
        fetch: universal_fetch_1.fetch,
    };
}
exports.getUnauthenticatedSession = getUnauthenticatedSession;
async function clear(sessionId, storage) {
    await Promise.all([
        storage.deleteAllUserData(sessionId, { secure: false }),
        storage.deleteAllUserData(sessionId, { secure: true }),
        storage.delete("clientKey", { secure: false }),
    ]);
    try {
        await (0, oidc_client_ext_1.clearOidcPersistentStorage)();
    }
    catch (e) {
        console.log(e);
        console.log(e);
    }
}
exports.clear = clear;
class SessionInfoManager {
    constructor(storageUtility) {
        this.storageUtility = storageUtility;
    }
    update(_sessionId, _options) {
        throw new Error("Not Implemented");
    }
    async get(sessionId) {
        var _a;
        const isLoggedIn = await this.storageUtility.getForUser(sessionId, "isLoggedIn", {
            secure: true,
        });
        const webId = await this.storageUtility.getForUser(sessionId, "webId", {
            secure: true,
        });
        const clientId = await this.storageUtility.getForUser(sessionId, "clientId", {
            secure: false,
        });
        const clientSecret = await this.storageUtility.getForUser(sessionId, "clientSecret", {
            secure: false,
        });
        const redirectUrl = await this.storageUtility.getForUser(sessionId, "redirectUrl", {
            secure: false,
        });
        const refreshToken = await this.storageUtility.getForUser(sessionId, "refreshToken", {
            secure: true,
        });
        const issuer = await this.storageUtility.getForUser(sessionId, "issuer", {
            secure: false,
        });
        const tokenType = (_a = (await this.storageUtility.getForUser(sessionId, "tokenType", {
            secure: false,
        }))) !== null && _a !== void 0 ? _a : "DPoP";
        if (!(0, solid_client_authn_core_1.isSupportedTokenType)(tokenType)) {
            throw new Error(`Tokens of type [${tokenType}] are not supported.`);
        }
        if (clientId === undefined &&
            isLoggedIn === undefined &&
            webId === undefined &&
            refreshToken === undefined) {
            return undefined;
        }
        return {
            sessionId,
            webId,
            isLoggedIn: isLoggedIn === "true",
            redirectUrl,
            refreshToken,
            issuer,
            clientAppId: clientId,
            clientAppSecret: clientSecret,
            tokenType,
        };
    }
    async getAll() {
        throw new Error("Not implemented");
    }
    async clear(sessionId) {
        return clear(sessionId, this.storageUtility);
    }
    async register(_sessionId) {
        throw new Error("Not implemented");
    }
    async getRegisteredSessionIdAll() {
        throw new Error("Not implemented");
    }
    async clearAll() {
        throw new Error("Not implemented");
    }
}
exports.SessionInfoManager = SessionInfoManager;


/***/ }),

/***/ "./src/storage/BrowserStorage.ts":
/*!***************************************!*\
  !*** ./src/storage/BrowserStorage.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class BrowserStorage {
    get storage() {
        return window.localStorage ? window.localStorage : window.sessionStorage;
    }
    async get(key) {
        return this.storage.getItem(key) || undefined;
    }
    async set(key, value) {
        this.storage.setItem(key, value);
    }
    async delete(key) {
        this.storage.removeItem(key);
    }
}
exports["default"] = BrowserStorage;


/***/ }),

/***/ "./src/storage/StorageUtility.ts":
/*!***************************************!*\
  !*** ./src/storage/StorageUtility.ts ***!
  \***************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const solid_client_authn_core_1 = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.js");
class StorageUtilityBrowser extends solid_client_authn_core_1.StorageUtility {
    constructor(secureStorage, insecureStorage) {
        super(secureStorage, insecureStorage);
    }
}
exports["default"] = StorageUtilityBrowser;


/***/ }),

/***/ "./node_modules/@inrupt/universal-fetch/dist/index-browser.js":
/*!********************************************************************!*\
  !*** ./node_modules/@inrupt/universal-fetch/dist/index-browser.js ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

var indexBrowser = globalThis.fetch;
const { fetch, Response, Request, Headers } = globalThis;

exports.Headers = Headers;
exports.Request = Request;
exports.Response = Response;
exports["default"] = indexBrowser;
exports.fetch = fetch;


/***/ }),

/***/ "./node_modules/events/events.js":
/*!***************************************!*\
  !*** ./node_modules/events/events.js ***!
  \***************************************/
/***/ ((module) => {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}


/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/index.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
Object.defineProperty(exports, "NIL", ({
  enumerable: true,
  get: function get() {
    return _nil.default;
  }
}));
Object.defineProperty(exports, "parse", ({
  enumerable: true,
  get: function get() {
    return _parse.default;
  }
}));
Object.defineProperty(exports, "stringify", ({
  enumerable: true,
  get: function get() {
    return _stringify.default;
  }
}));
Object.defineProperty(exports, "v1", ({
  enumerable: true,
  get: function get() {
    return _v.default;
  }
}));
Object.defineProperty(exports, "v3", ({
  enumerable: true,
  get: function get() {
    return _v2.default;
  }
}));
Object.defineProperty(exports, "v4", ({
  enumerable: true,
  get: function get() {
    return _v3.default;
  }
}));
Object.defineProperty(exports, "v5", ({
  enumerable: true,
  get: function get() {
    return _v4.default;
  }
}));
Object.defineProperty(exports, "validate", ({
  enumerable: true,
  get: function get() {
    return _validate.default;
  }
}));
Object.defineProperty(exports, "version", ({
  enumerable: true,
  get: function get() {
    return _version.default;
  }
}));

var _v = _interopRequireDefault(__webpack_require__(/*! ./v1.js */ "./node_modules/uuid/dist/commonjs-browser/v1.js"));

var _v2 = _interopRequireDefault(__webpack_require__(/*! ./v3.js */ "./node_modules/uuid/dist/commonjs-browser/v3.js"));

var _v3 = _interopRequireDefault(__webpack_require__(/*! ./v4.js */ "./node_modules/uuid/dist/commonjs-browser/v4.js"));

var _v4 = _interopRequireDefault(__webpack_require__(/*! ./v5.js */ "./node_modules/uuid/dist/commonjs-browser/v5.js"));

var _nil = _interopRequireDefault(__webpack_require__(/*! ./nil.js */ "./node_modules/uuid/dist/commonjs-browser/nil.js"));

var _version = _interopRequireDefault(__webpack_require__(/*! ./version.js */ "./node_modules/uuid/dist/commonjs-browser/version.js"));

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/commonjs-browser/validate.js"));

var _stringify = _interopRequireDefault(__webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/commonjs-browser/stringify.js"));

var _parse = _interopRequireDefault(__webpack_require__(/*! ./parse.js */ "./node_modules/uuid/dist/commonjs-browser/parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/md5.js":
/*!********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/md5.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (let i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  const output = [];
  const length32 = input.length * 32;
  const hexTab = '0123456789abcdef';

  for (let i = 0; i < length32; i += 8) {
    const x = input[i >> 5] >>> i % 32 & 0xff;
    const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  const length8 = input.length * 8;
  const output = new Uint32Array(getOutputLength(length8));

  for (let i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var _default = md5;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/native.js":
/*!***********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/native.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var _default = {
  randomUUID
};
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/nil.js":
/*!********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/nil.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/parse.js":
/*!**********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/parse.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/regex.js":
/*!**********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/regex.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/rng.js":
/*!********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/rng.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = rng;
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
let getRandomValues;
const rnds8 = new Uint8Array(16);

function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/sha1.js":
/*!*********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/sha1.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (let i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  const l = bytes.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = new Array(N);

  for (let i = 0; i < N; ++i) {
    const arr = new Uint32Array(16);

    for (let j = 0; j < 16; ++j) {
      arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
    }

    M[i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (let i = 0; i < N; ++i) {
    const W = new Uint32Array(80);

    for (let t = 0; t < 16; ++t) {
      W[t] = M[i][t];
    }

    for (let t = 16; t < 80; ++t) {
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];

    for (let t = 0; t < 80; ++t) {
      const s = Math.floor(t / 20);
      const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var _default = sha1;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/stringify.js":
/*!**************************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/stringify.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
exports.unsafeStringify = unsafeStringify;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/v1.js":
/*!*******************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/v1.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _rng = _interopRequireDefault(__webpack_require__(/*! ./rng.js */ "./node_modules/uuid/dist/commonjs-browser/rng.js"));

var _stringify = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/commonjs-browser/stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.unsafeStringify)(b);
}

var _default = v1;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/v3.js":
/*!*******************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/v3.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__webpack_require__(/*! ./v35.js */ "./node_modules/uuid/dist/commonjs-browser/v35.js"));

var _md = _interopRequireDefault(__webpack_require__(/*! ./md5.js */ "./node_modules/uuid/dist/commonjs-browser/md5.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/v35.js":
/*!********************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/v35.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.URL = exports.DNS = void 0;
exports["default"] = v35;

var _stringify = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/commonjs-browser/stringify.js");

var _parse = _interopRequireDefault(__webpack_require__(/*! ./parse.js */ "./node_modules/uuid/dist/commonjs-browser/parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function v35(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    var _namespace;

    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.unsafeStringify)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/v4.js":
/*!*******************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/v4.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _native = _interopRequireDefault(__webpack_require__(/*! ./native.js */ "./node_modules/uuid/dist/commonjs-browser/native.js"));

var _rng = _interopRequireDefault(__webpack_require__(/*! ./rng.js */ "./node_modules/uuid/dist/commonjs-browser/rng.js"));

var _stringify = __webpack_require__(/*! ./stringify.js */ "./node_modules/uuid/dist/commonjs-browser/stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  if (_native.default.randomUUID && !buf && !options) {
    return _native.default.randomUUID();
  }

  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.unsafeStringify)(rnds);
}

var _default = v4;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/v5.js":
/*!*******************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/v5.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__webpack_require__(/*! ./v35.js */ "./node_modules/uuid/dist/commonjs-browser/v35.js"));

var _sha = _interopRequireDefault(__webpack_require__(/*! ./sha1.js */ "./node_modules/uuid/dist/commonjs-browser/sha1.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/validate.js":
/*!*************************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/validate.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _regex = _interopRequireDefault(__webpack_require__(/*! ./regex.js */ "./node_modules/uuid/dist/commonjs-browser/regex.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports["default"] = _default;

/***/ }),

/***/ "./node_modules/uuid/dist/commonjs-browser/version.js":
/*!************************************************************!*\
  !*** ./node_modules/uuid/dist/commonjs-browser/version.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "./node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.slice(14, 15), 16);
}

var _default = version;
exports["default"] = _default;

/***/ }),

/***/ "../core/dist/index.js":
/*!*****************************!*\
  !*** ../core/dist/index.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


var events = __webpack_require__(/*! events */ "../core/node_modules/events/events.js");
var universalFetch = __webpack_require__(/*! @inrupt/universal-fetch */ "../core/node_modules/@inrupt/universal-fetch/dist/index-browser.js");
var jose = __webpack_require__(/*! jose */ "../core/node_modules/jose/dist/browser/index.js");
var uuid = __webpack_require__(/*! uuid */ "../core/node_modules/uuid/dist/commonjs-browser/index.js");

const SOLID_CLIENT_AUTHN_KEY_PREFIX = "solidClientAuthn:";
const PREFERRED_SIGNING_ALG = ["ES256", "RS256"];
const EVENTS = {
    ERROR: "error",
    LOGIN: "login",
    LOGOUT: "logout",
    NEW_REFRESH_TOKEN: "newRefreshToken",
    SESSION_EXPIRED: "sessionExpired",
    SESSION_EXTENDED: "sessionExtended",
    SESSION_RESTORED: "sessionRestore",
    TIMEOUT_SET: "timeoutSet",
};
const REFRESH_BEFORE_EXPIRATION_SECONDS = 5;
const SCOPE_OPENID = "openid";
const SCOPE_OFFLINE = "offline_access";
const SCOPE_WEBID = "webid";
const DEFAULT_SCOPES = [SCOPE_OPENID, SCOPE_OFFLINE, SCOPE_WEBID].join(" ");

const buildProxyHandler = (toExclude, errorMessage) => ({
    get(target, prop, receiver) {
        if (!Object.getOwnPropertyNames(events.EventEmitter).includes(prop) &&
            Object.getOwnPropertyNames(toExclude).includes(prop)) {
            throw new Error(`${errorMessage}: [${prop}] is not supported`);
        }
        return Reflect.get(target, prop, receiver);
    },
});

class AggregateHandler {
    constructor(handleables) {
        this.handleables = handleables;
    }
    async getProperHandler(params) {
        const canHandleList = await Promise.all(this.handleables.map((handleable) => handleable.canHandle(...params)));
        for (let i = 0; i < canHandleList.length; i += 1) {
            if (canHandleList[i]) {
                return this.handleables[i];
            }
        }
        return null;
    }
    async canHandle(...params) {
        return (await this.getProperHandler(params)) !== null;
    }
    async handle(...params) {
        const handler = await this.getProperHandler(params);
        if (handler) {
            return handler.handle(...params);
        }
        throw new Error(`[${this.constructor.name}] cannot find a suitable handler for: ${params
            .map((param) => {
            try {
                return JSON.stringify(param);
            }
            catch (err) {
                return param.toString();
            }
        })
            .join(", ")}`);
    }
}

async function fetchJwks(jwksIri, issuerIri) {
    const jwksResponse = await universalFetch.fetch(jwksIri);
    if (jwksResponse.status !== 200) {
        throw new Error(`Could not fetch JWKS for [${issuerIri}] at [${jwksIri}]: ${jwksResponse.status} ${jwksResponse.statusText}`);
    }
    let jwk;
    try {
        jwk = (await jwksResponse.json()).keys[0];
    }
    catch (e) {
        throw new Error(`Malformed JWKS for [${issuerIri}] at [${jwksIri}]: ${e.message}`);
    }
    return jwk;
}
async function getWebidFromTokenPayload(idToken, jwksIri, issuerIri, clientId) {
    const jwk = await fetchJwks(jwksIri, issuerIri);
    let payload;
    try {
        const { payload: verifiedPayload } = await jose.jwtVerify(idToken, await jose.importJWK(jwk), {
            issuer: issuerIri,
            audience: clientId,
        });
        payload = verifiedPayload;
    }
    catch (e) {
        throw new Error(`Token verification failed: ${e.stack}`);
    }
    if (typeof payload.webid === "string") {
        return payload.webid;
    }
    if (typeof payload.sub !== "string") {
        throw new Error(`The token ${JSON.stringify(payload)} is invalid: it has no 'webid' claim and no 'sub' claim.`);
    }
    try {
        new URL(payload.sub);
        return payload.sub;
    }
    catch (e) {
        throw new Error(`The token has no 'webid' claim, and its 'sub' claim of [${payload.sub}] is invalid as a URL - error [${e}].`);
    }
}

function isValidRedirectUrl(redirectUrl) {
    try {
        const urlObject = new URL(redirectUrl);
        return urlObject.hash === "";
    }
    catch (e) {
        return false;
    }
}

function isSupportedTokenType(token) {
    return typeof token === "string" && ["DPoP", "Bearer"].includes(token);
}

const USER_SESSION_PREFIX = "solidClientAuthenticationUser";

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function determineSigningAlg(supported, preferred) {
    var _a;
    return ((_a = preferred.find((signingAlg) => {
        return supported.includes(signingAlg);
    })) !== null && _a !== void 0 ? _a : null);
}
function determineClientType(options, issuerConfig) {
    if (options.clientId !== undefined && !isValidUrl(options.clientId)) {
        return "static";
    }
    if (issuerConfig.scopesSupported.includes("webid") &&
        options.clientId !== undefined &&
        isValidUrl(options.clientId)) {
        return "solid-oidc";
    }
    return "dynamic";
}
async function handleRegistration(options, issuerConfig, storageUtility, clientRegistrar) {
    const clientType = determineClientType(options, issuerConfig);
    if (clientType === "dynamic") {
        return clientRegistrar.getClient({
            sessionId: options.sessionId,
            clientName: options.clientName,
            redirectUrl: options.redirectUrl,
        }, issuerConfig);
    }
    await storageUtility.setForUser(options.sessionId, {
        clientId: options.clientId,
    });
    if (options.clientSecret) {
        await storageUtility.setForUser(options.sessionId, {
            clientSecret: options.clientSecret,
        });
    }
    if (options.clientName) {
        await storageUtility.setForUser(options.sessionId, {
            clientName: options.clientName,
        });
    }
    return {
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        clientName: options.clientName,
        clientType,
    };
}

async function getSessionIdFromOauthState(storageUtility, oauthState) {
    return storageUtility.getForUser(oauthState, "sessionId");
}
async function loadOidcContextFromStorage(sessionId, storageUtility, configFetcher) {
    try {
        const [issuerIri, codeVerifier, storedRedirectIri, dpop] = await Promise.all([
            storageUtility.getForUser(sessionId, "issuer", {
                errorIfNull: true,
            }),
            storageUtility.getForUser(sessionId, "codeVerifier"),
            storageUtility.getForUser(sessionId, "redirectUrl"),
            storageUtility.getForUser(sessionId, "dpop", { errorIfNull: true }),
        ]);
        await storageUtility.deleteForUser(sessionId, "codeVerifier");
        const issuerConfig = await configFetcher.fetchConfig(issuerIri);
        return {
            codeVerifier,
            redirectUrl: storedRedirectIri,
            issuerConfig,
            dpop: dpop === "true",
        };
    }
    catch (e) {
        throw new Error(`Failed to retrieve OIDC context from storage associated with session [${sessionId}]: ${e}`);
    }
}
async function saveSessionInfoToStorage(storageUtility, sessionId, webId, isLoggedIn, refreshToken, secure, dpopKey) {
    if (refreshToken !== undefined) {
        await storageUtility.setForUser(sessionId, { refreshToken }, { secure });
    }
    if (webId !== undefined) {
        await storageUtility.setForUser(sessionId, { webId }, { secure });
    }
    if (isLoggedIn !== undefined) {
        await storageUtility.setForUser(sessionId, { isLoggedIn }, { secure });
    }
    if (dpopKey !== undefined) {
        await storageUtility.setForUser(sessionId, {
            publicKey: JSON.stringify(dpopKey.publicKey),
            privateKey: JSON.stringify(await jose.exportJWK(dpopKey.privateKey)),
        }, { secure });
    }
}
class StorageUtility {
    constructor(secureStorage, insecureStorage) {
        this.secureStorage = secureStorage;
        this.insecureStorage = insecureStorage;
    }
    getKey(userId) {
        return `solidClientAuthenticationUser:${userId}`;
    }
    async getUserData(userId, secure) {
        const stored = await (secure
            ? this.secureStorage
            : this.insecureStorage).get(this.getKey(userId));
        if (stored === undefined) {
            return {};
        }
        try {
            return JSON.parse(stored);
        }
        catch (err) {
            throw new Error(`Data for user [${userId}] in [${secure ? "secure" : "unsecure"}] storage is corrupted - expected valid JSON, but got: ${stored}`);
        }
    }
    async setUserData(userId, data, secure) {
        await (secure ? this.secureStorage : this.insecureStorage).set(this.getKey(userId), JSON.stringify(data));
    }
    async get(key, options) {
        const value = await ((options === null || options === void 0 ? void 0 : options.secure)
            ? this.secureStorage
            : this.insecureStorage).get(key);
        if (value === undefined && (options === null || options === void 0 ? void 0 : options.errorIfNull)) {
            throw new Error(`[${key}] is not stored`);
        }
        return value;
    }
    async set(key, value, options) {
        return ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).set(key, value);
    }
    async delete(key, options) {
        return ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).delete(key);
    }
    async getForUser(userId, key, options) {
        const userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        let value;
        if (!userData || !userData[key]) {
            value = undefined;
        }
        value = userData[key];
        if (value === undefined && (options === null || options === void 0 ? void 0 : options.errorIfNull)) {
            throw new Error(`Field [${key}] for user [${userId}] is not stored`);
        }
        return value || undefined;
    }
    async setForUser(userId, values, options) {
        let userData;
        try {
            userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        }
        catch (_a) {
            userData = {};
        }
        await this.setUserData(userId, { ...userData, ...values }, options === null || options === void 0 ? void 0 : options.secure);
    }
    async deleteForUser(userId, key, options) {
        const userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        delete userData[key];
        await this.setUserData(userId, userData, options === null || options === void 0 ? void 0 : options.secure);
    }
    async deleteAllUserData(userId, options) {
        await ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).delete(this.getKey(userId));
    }
}

class InMemoryStorage {
    constructor() {
        this.map = {};
    }
    async get(key) {
        return this.map[key] || undefined;
    }
    async set(key, value) {
        this.map[key] = value;
    }
    async delete(key) {
        delete this.map[key];
    }
}

class ConfigurationError extends Error {
    constructor(message) {
        super(message);
    }
}

class NotImplementedError extends Error {
    constructor(methodName) {
        super(`[${methodName}] is not implemented`);
    }
}

class InvalidResponseError extends Error {
    constructor(missingFields) {
        super(`Invalid response from OIDC provider: missing fields ${missingFields}`);
        this.missingFields = missingFields;
    }
}

class OidcProviderError extends Error {
    constructor(message, error, errorDescription) {
        super(message);
        this.error = error;
        this.errorDescription = errorDescription;
    }
}

function normalizeHTU(audience) {
    const audienceUrl = new URL(audience);
    return new URL(audienceUrl.pathname, audienceUrl.origin).toString();
}
async function createDpopHeader(audience, method, dpopKey) {
    return new jose.SignJWT({
        htu: normalizeHTU(audience),
        htm: method.toUpperCase(),
        jti: uuid.v4(),
    })
        .setProtectedHeader({
        alg: PREFERRED_SIGNING_ALG[0],
        jwk: dpopKey.publicKey,
        typ: "dpop+jwt",
    })
        .setIssuedAt()
        .sign(dpopKey.privateKey, {});
}
async function generateDpopKeyPair() {
    const { privateKey, publicKey } = await jose.generateKeyPair(PREFERRED_SIGNING_ALG[0], { extractable: true });
    const dpopKeyPair = {
        privateKey,
        publicKey: await jose.exportJWK(publicKey),
        privateKeyJWK: await jose.exportJWK(privateKey)
    };
    [dpopKeyPair.publicKey.alg] = PREFERRED_SIGNING_ALG;
    [dpopKeyPair.privateKeyJWK.alg] = PREFERRED_SIGNING_ALG;
    return dpopKeyPair;
}
async function importDpopKeyPair(pubKey, privKey) {
    const publicKey = pubKey;
    const privateKeyJWK = privKey;
    const key = await jose.importJWK(privateKeyJWK);
    const dpopKeyPair = {
        privateKey: key,
        publicKey,
        privateKeyJWK
    };
    return dpopKeyPair;
}

const DEFAULT_EXPIRATION_TIME_SECONDS = 600;
function isExpectedAuthError(statusCode) {
    return [401, 403].includes(statusCode);
}
async function buildDpopFetchOptions(targetUrl, authToken, dpopKey, defaultOptions) {
    var _a;
    const headers = new universalFetch.Headers(defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.headers);
    headers.set("Authorization", `DPoP ${authToken}`);
    headers.set("DPoP", await createDpopHeader(targetUrl, (_a = defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.method) !== null && _a !== void 0 ? _a : "get", dpopKey));
    return {
        ...defaultOptions,
        headers,
    };
}
async function buildAuthenticatedHeaders(targetUrl, authToken, dpopKey, defaultOptions) {
    if (dpopKey !== undefined) {
        return buildDpopFetchOptions(targetUrl, authToken, dpopKey, defaultOptions);
    }
    const headers = new universalFetch.Headers(defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.headers);
    headers.set("Authorization", `Bearer ${authToken}`);
    return {
        ...defaultOptions,
        headers,
    };
}
async function makeAuthenticatedRequest(unauthFetch, accessToken, url, defaultRequestInit, dpopKey) {
    return unauthFetch(url, await buildAuthenticatedHeaders(url.toString(), accessToken, dpopKey, defaultRequestInit));
}
async function refreshAccessToken(refreshOptions, dpopKey, eventEmitter) {
    var _a;
    const tokenSet = await refreshOptions.tokenRefresher.refresh(refreshOptions.sessionId, refreshOptions.refreshToken, dpopKey);
    eventEmitter === null || eventEmitter === void 0 ? void 0 : eventEmitter.emit(EVENTS.SESSION_EXTENDED, (_a = tokenSet.expiresIn) !== null && _a !== void 0 ? _a : DEFAULT_EXPIRATION_TIME_SECONDS);
    if (typeof tokenSet.refreshToken === "string") {
        eventEmitter === null || eventEmitter === void 0 ? void 0 : eventEmitter.emit(EVENTS.NEW_REFRESH_TOKEN, tokenSet.refreshToken);
    }
    return {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        expiresIn: tokenSet.expiresIn,
    };
}
const computeRefreshDelay = (expiresIn) => {
    if (expiresIn !== undefined) {
        return expiresIn - REFRESH_BEFORE_EXPIRATION_SECONDS > 0
            ?
                expiresIn - REFRESH_BEFORE_EXPIRATION_SECONDS
            : expiresIn;
    }
    return DEFAULT_EXPIRATION_TIME_SECONDS;
};
async function buildAuthenticatedFetch(unauthFetch, accessToken, options) {
    var _a;
    let currentAccessToken = accessToken;
    let latestTimeout;
    const currentRefreshOptions = options === null || options === void 0 ? void 0 : options.refreshOptions;
    if (currentRefreshOptions !== undefined) {
        const proactivelyRefreshToken = async () => {
            var _a, _b, _c, _d;
            try {
                const { accessToken: refreshedAccessToken, refreshToken, expiresIn, } = await refreshAccessToken(currentRefreshOptions, options.dpopKey, options.eventEmitter);
                currentAccessToken = refreshedAccessToken;
                if (refreshToken !== undefined) {
                    currentRefreshOptions.refreshToken = refreshToken;
                }
                clearTimeout(latestTimeout);
                latestTimeout = setTimeout(proactivelyRefreshToken, computeRefreshDelay(expiresIn) * 1000);
                (_a = options.eventEmitter) === null || _a === void 0 ? void 0 : _a.emit(EVENTS.TIMEOUT_SET, latestTimeout);
            }
            catch (e) {
                if (e instanceof OidcProviderError) {
                    (_b = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _b === void 0 ? void 0 : _b.emit(EVENTS.ERROR, e.error, e.errorDescription);
                    (_c = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _c === void 0 ? void 0 : _c.emit(EVENTS.SESSION_EXPIRED);
                }
                if (e instanceof InvalidResponseError &&
                    e.missingFields.includes("access_token")) {
                    (_d = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _d === void 0 ? void 0 : _d.emit(EVENTS.SESSION_EXPIRED);
                }
            }
        };
        latestTimeout = setTimeout(proactivelyRefreshToken, computeRefreshDelay(options.expiresIn) * 1000);
        (_a = options.eventEmitter) === null || _a === void 0 ? void 0 : _a.emit(EVENTS.TIMEOUT_SET, latestTimeout);
    }
    else if (options !== undefined && options.eventEmitter !== undefined) {
        const expirationTimeout = setTimeout(() => {
            options.eventEmitter.emit(EVENTS.SESSION_EXPIRED);
        }, computeRefreshDelay(options.expiresIn) * 1000);
        options.eventEmitter.emit(EVENTS.TIMEOUT_SET, expirationTimeout);
    }
    return async (url, requestInit) => {
        let response = await makeAuthenticatedRequest(unauthFetch, currentAccessToken, url, requestInit, options === null || options === void 0 ? void 0 : options.dpopKey);
        const failedButNotExpectedAuthError = !response.ok && !isExpectedAuthError(response.status);
        if (response.ok || failedButNotExpectedAuthError) {
            return response;
        }
        const hasBeenRedirected = response.url !== url;
        if (hasBeenRedirected && (options === null || options === void 0 ? void 0 : options.dpopKey) !== undefined) {
            response = await makeAuthenticatedRequest(unauthFetch, currentAccessToken, response.url, requestInit, options.dpopKey);
        }
        return response;
    };
}

const StorageUtilityGetResponse = "getResponse";
const StorageUtilityMock = {
    get: async (key, options) => StorageUtilityGetResponse,
    set: async (key, value) => {
    },
    delete: async (key) => {
    },
    getForUser: async (userId, key, options) => StorageUtilityGetResponse,
    setForUser: async (userId, values, options) => {
    },
    deleteForUser: async (userId, key, options) => {
    },
    deleteAllUserData: async (userId, options) => {
    },
};
const mockStorage = (stored) => {
    const store = stored;
    return {
        get: async (key) => {
            if (store[key] === undefined) {
                return undefined;
            }
            if (typeof store[key] === "string") {
                return store[key];
            }
            return JSON.stringify(store[key]);
        },
        set: async (key, value) => {
            store[key] = value;
        },
        delete: async (key) => {
            delete store[key];
        },
    };
};
const mockStorageUtility = (stored, isSecure = false) => {
    if (isSecure) {
        return new StorageUtility(mockStorage(stored), mockStorage({}));
    }
    return new StorageUtility(mockStorage({}), mockStorage(stored));
};

exports.AggregateHandler = AggregateHandler;
exports.ConfigurationError = ConfigurationError;
exports.DEFAULT_SCOPES = DEFAULT_SCOPES;
exports.EVENTS = EVENTS;
exports.InMemoryStorage = InMemoryStorage;
exports.InvalidResponseError = InvalidResponseError;
exports.NotImplementedError = NotImplementedError;
exports.OidcProviderError = OidcProviderError;
exports.PREFERRED_SIGNING_ALG = PREFERRED_SIGNING_ALG;
exports.REFRESH_BEFORE_EXPIRATION_SECONDS = REFRESH_BEFORE_EXPIRATION_SECONDS;
exports.SOLID_CLIENT_AUTHN_KEY_PREFIX = SOLID_CLIENT_AUTHN_KEY_PREFIX;
exports.StorageUtility = StorageUtility;
exports.StorageUtilityGetResponse = StorageUtilityGetResponse;
exports.StorageUtilityMock = StorageUtilityMock;
exports.USER_SESSION_PREFIX = USER_SESSION_PREFIX;
exports.buildAuthenticatedFetch = buildAuthenticatedFetch;
exports.buildProxyHandler = buildProxyHandler;
exports.createDpopHeader = createDpopHeader;
exports.determineSigningAlg = determineSigningAlg;
exports.fetchJwks = fetchJwks;
exports.generateDpopKeyPair = generateDpopKeyPair;
exports.getSessionIdFromOauthState = getSessionIdFromOauthState;
exports.getWebidFromTokenPayload = getWebidFromTokenPayload;
exports.handleRegistration = handleRegistration;
exports.importDpopKeyPair = importDpopKeyPair;
exports.isSupportedTokenType = isSupportedTokenType;
exports.isValidRedirectUrl = isValidRedirectUrl;
exports.loadOidcContextFromStorage = loadOidcContextFromStorage;
exports.mockStorage = mockStorage;
exports.mockStorageUtility = mockStorageUtility;
exports.saveSessionInfoToStorage = saveSessionInfoToStorage;


/***/ }),

/***/ "../core/node_modules/@inrupt/universal-fetch/dist/index-browser.js":
/*!**************************************************************************!*\
  !*** ../core/node_modules/@inrupt/universal-fetch/dist/index-browser.js ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({ value: true }));

var indexBrowser = globalThis.fetch;
const { fetch, Response, Request, Headers } = globalThis;

exports.Headers = Headers;
exports.Request = Request;
exports.Response = Response;
exports["default"] = indexBrowser;
exports.fetch = fetch;


/***/ }),

/***/ "../core/node_modules/events/events.js":
/*!*********************************************!*\
  !*** ../core/node_modules/events/events.js ***!
  \*********************************************/
/***/ ((module) => {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}


/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/index.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/index.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
Object.defineProperty(exports, "NIL", ({
  enumerable: true,
  get: function get() {
    return _nil.default;
  }
}));
Object.defineProperty(exports, "parse", ({
  enumerable: true,
  get: function get() {
    return _parse.default;
  }
}));
Object.defineProperty(exports, "stringify", ({
  enumerable: true,
  get: function get() {
    return _stringify.default;
  }
}));
Object.defineProperty(exports, "v1", ({
  enumerable: true,
  get: function get() {
    return _v.default;
  }
}));
Object.defineProperty(exports, "v3", ({
  enumerable: true,
  get: function get() {
    return _v2.default;
  }
}));
Object.defineProperty(exports, "v4", ({
  enumerable: true,
  get: function get() {
    return _v3.default;
  }
}));
Object.defineProperty(exports, "v5", ({
  enumerable: true,
  get: function get() {
    return _v4.default;
  }
}));
Object.defineProperty(exports, "validate", ({
  enumerable: true,
  get: function get() {
    return _validate.default;
  }
}));
Object.defineProperty(exports, "version", ({
  enumerable: true,
  get: function get() {
    return _version.default;
  }
}));

var _v = _interopRequireDefault(__webpack_require__(/*! ./v1.js */ "../core/node_modules/uuid/dist/commonjs-browser/v1.js"));

var _v2 = _interopRequireDefault(__webpack_require__(/*! ./v3.js */ "../core/node_modules/uuid/dist/commonjs-browser/v3.js"));

var _v3 = _interopRequireDefault(__webpack_require__(/*! ./v4.js */ "../core/node_modules/uuid/dist/commonjs-browser/v4.js"));

var _v4 = _interopRequireDefault(__webpack_require__(/*! ./v5.js */ "../core/node_modules/uuid/dist/commonjs-browser/v5.js"));

var _nil = _interopRequireDefault(__webpack_require__(/*! ./nil.js */ "../core/node_modules/uuid/dist/commonjs-browser/nil.js"));

var _version = _interopRequireDefault(__webpack_require__(/*! ./version.js */ "../core/node_modules/uuid/dist/commonjs-browser/version.js"));

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "../core/node_modules/uuid/dist/commonjs-browser/validate.js"));

var _stringify = _interopRequireDefault(__webpack_require__(/*! ./stringify.js */ "../core/node_modules/uuid/dist/commonjs-browser/stringify.js"));

var _parse = _interopRequireDefault(__webpack_require__(/*! ./parse.js */ "../core/node_modules/uuid/dist/commonjs-browser/parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/md5.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/md5.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (let i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  const output = [];
  const length32 = input.length * 32;
  const hexTab = '0123456789abcdef';

  for (let i = 0; i < length32; i += 8) {
    const x = input[i >> 5] >>> i % 32 & 0xff;
    const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  const length8 = input.length * 8;
  const output = new Uint32Array(getOutputLength(length8));

  for (let i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var _default = md5;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/native.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/native.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var _default = {
  randomUUID
};
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/nil.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/nil.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/parse.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/parse.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "../core/node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/regex.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/regex.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/rng.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/rng.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = rng;
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
let getRandomValues;
const rnds8 = new Uint8Array(16);

function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/sha1.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/sha1.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (let i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  const l = bytes.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = new Array(N);

  for (let i = 0; i < N; ++i) {
    const arr = new Uint32Array(16);

    for (let j = 0; j < 16; ++j) {
      arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
    }

    M[i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (let i = 0; i < N; ++i) {
    const W = new Uint32Array(80);

    for (let t = 0; t < 16; ++t) {
      W[t] = M[i][t];
    }

    for (let t = 16; t < 80; ++t) {
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];

    for (let t = 0; t < 80; ++t) {
      const s = Math.floor(t / 20);
      const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var _default = sha1;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/stringify.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/stringify.js ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
exports.unsafeStringify = unsafeStringify;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "../core/node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/v1.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/v1.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _rng = _interopRequireDefault(__webpack_require__(/*! ./rng.js */ "../core/node_modules/uuid/dist/commonjs-browser/rng.js"));

var _stringify = __webpack_require__(/*! ./stringify.js */ "../core/node_modules/uuid/dist/commonjs-browser/stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.unsafeStringify)(b);
}

var _default = v1;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/v3.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/v3.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__webpack_require__(/*! ./v35.js */ "../core/node_modules/uuid/dist/commonjs-browser/v35.js"));

var _md = _interopRequireDefault(__webpack_require__(/*! ./md5.js */ "../core/node_modules/uuid/dist/commonjs-browser/md5.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/v35.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/v35.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.URL = exports.DNS = void 0;
exports["default"] = v35;

var _stringify = __webpack_require__(/*! ./stringify.js */ "../core/node_modules/uuid/dist/commonjs-browser/stringify.js");

var _parse = _interopRequireDefault(__webpack_require__(/*! ./parse.js */ "../core/node_modules/uuid/dist/commonjs-browser/parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function v35(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    var _namespace;

    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.unsafeStringify)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/v4.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/v4.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _native = _interopRequireDefault(__webpack_require__(/*! ./native.js */ "../core/node_modules/uuid/dist/commonjs-browser/native.js"));

var _rng = _interopRequireDefault(__webpack_require__(/*! ./rng.js */ "../core/node_modules/uuid/dist/commonjs-browser/rng.js"));

var _stringify = __webpack_require__(/*! ./stringify.js */ "../core/node_modules/uuid/dist/commonjs-browser/stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  if (_native.default.randomUUID && !buf && !options) {
    return _native.default.randomUUID();
  }

  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.unsafeStringify)(rnds);
}

var _default = v4;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/v5.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/v5.js ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__webpack_require__(/*! ./v35.js */ "../core/node_modules/uuid/dist/commonjs-browser/v35.js"));

var _sha = _interopRequireDefault(__webpack_require__(/*! ./sha1.js */ "../core/node_modules/uuid/dist/commonjs-browser/sha1.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/validate.js":
/*!*******************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/validate.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _regex = _interopRequireDefault(__webpack_require__(/*! ./regex.js */ "../core/node_modules/uuid/dist/commonjs-browser/regex.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/commonjs-browser/version.js":
/*!******************************************************************!*\
  !*** ../core/node_modules/uuid/dist/commonjs-browser/version.js ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__webpack_require__(/*! ./validate.js */ "../core/node_modules/uuid/dist/commonjs-browser/validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.slice(14, 15), 16);
}

var _default = version;
exports["default"] = _default;

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/native.js":
/*!************************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/native.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  randomUUID
});

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/regex.js":
/*!***********************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/regex.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/rng.js":
/*!*********************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/rng.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ rng)
/* harmony export */ });
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
let getRandomValues;
const rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/stringify.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/stringify.js ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "unsafeStringify": () => (/* binding */ unsafeStringify)
/* harmony export */ });
/* harmony import */ var _validate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./validate.js */ "../core/node_modules/uuid/dist/esm-browser/validate.js");

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */

const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0,_validate_js__WEBPACK_IMPORTED_MODULE_0__["default"])(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (stringify);

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/v4.js":
/*!********************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/v4.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _native_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./native.js */ "../core/node_modules/uuid/dist/esm-browser/native.js");
/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./rng.js */ "../core/node_modules/uuid/dist/esm-browser/rng.js");
/* harmony import */ var _stringify_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./stringify.js */ "../core/node_modules/uuid/dist/esm-browser/stringify.js");




function v4(options, buf, offset) {
  if (_native_js__WEBPACK_IMPORTED_MODULE_0__["default"].randomUUID && !buf && !options) {
    return _native_js__WEBPACK_IMPORTED_MODULE_0__["default"].randomUUID();
  }

  options = options || {};
  const rnds = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_1__["default"])(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0,_stringify_js__WEBPACK_IMPORTED_MODULE_2__.unsafeStringify)(rnds);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v4);

/***/ }),

/***/ "../core/node_modules/uuid/dist/esm-browser/validate.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/uuid/dist/esm-browser/validate.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _regex_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./regex.js */ "../core/node_modules/uuid/dist/esm-browser/regex.js");


function validate(uuid) {
  return typeof uuid === 'string' && _regex_js__WEBPACK_IMPORTED_MODULE_0__["default"].test(uuid);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (validate);

/***/ }),

/***/ "../oidc-browser/dist/index.es.js":
/*!****************************************!*\
  !*** ../oidc-browser/dist/index.es.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CordovaIFrameNavigator": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.CordovaIFrameNavigator),
/* harmony export */   "CordovaPopupNavigator": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.CordovaPopupNavigator),
/* harmony export */   "InMemoryWebStorage": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.InMemoryWebStorage),
/* harmony export */   "Log": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.Log),
/* harmony export */   "OidcClient": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.OidcClient),
/* harmony export */   "SessionMonitor": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.SessionMonitor),
/* harmony export */   "User": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.User),
/* harmony export */   "UserManager": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.UserManager),
/* harmony export */   "Version": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.Version),
/* harmony export */   "WebStorageStateStore": () => (/* reexport safe */ _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.WebStorageStateStore),
/* harmony export */   "clearOidcPersistentStorage": () => (/* binding */ clearOidcPersistentStorage),
/* harmony export */   "getBearerToken": () => (/* binding */ getBearerToken),
/* harmony export */   "getDpopToken": () => (/* binding */ getDpopToken),
/* harmony export */   "importDpopToken": () => (/* binding */ importDpopToken),
/* harmony export */   "refresh": () => (/* binding */ refresh),
/* harmony export */   "registerClient": () => (/* binding */ registerClient),
/* harmony export */   "removeOidcQueryParam": () => (/* binding */ removeOidcQueryParam)
/* harmony export */ });
/* harmony import */ var _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @inrupt/oidc-client */ "../oidc-browser/node_modules/@inrupt/oidc-client/lib/oidc-client.min.js");
/* harmony import */ var _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @inrupt/solid-client-authn-core */ "../core/dist/index.mjs");
/* harmony import */ var _inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @inrupt/universal-fetch */ "../oidc-browser/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs");





function processErrorResponse(responseBody, options) {
    var _a, _b, _c, _d;
    if (responseBody.error === "invalid_redirect_uri") {
        throw new Error(`Dynamic client registration failed: the provided redirect uri [${(_a = options.redirectUrl) === null || _a === void 0 ? void 0 : _a.toString()}] is invalid - ${(_b = responseBody.error_description) !== null && _b !== void 0 ? _b : ""}`);
    }
    if (responseBody.error === "invalid_client_metadata") {
        throw new Error(`Dynamic client registration failed: the provided client metadata ${JSON.stringify(options)} is invalid - ${(_c = responseBody.error_description) !== null && _c !== void 0 ? _c : ""}`);
    }
    throw new Error(`Dynamic client registration failed: ${responseBody.error} - ${(_d = responseBody.error_description) !== null && _d !== void 0 ? _d : ""}`);
}
function validateRegistrationResponse(responseBody, options) {
    if (responseBody.client_id === undefined) {
        throw new Error(`Dynamic client registration failed: no client_id has been found on ${JSON.stringify(responseBody)}`);
    }
    if (options.redirectUrl &&
        (responseBody.redirect_uris === undefined ||
            responseBody.redirect_uris[0] !== options.redirectUrl.toString())) {
        throw new Error(`Dynamic client registration failed: the returned redirect URIs ${JSON.stringify(responseBody.redirect_uris)} don't match the provided ${JSON.stringify([
            options.redirectUrl.toString(),
        ])}`);
    }
}
async function registerClient(options, issuerConfig) {
    var _a;
    if (!issuerConfig.registrationEndpoint) {
        throw new Error("Dynamic Registration could not be completed because the issuer has no registration endpoint.");
    }
    if (!Array.isArray(issuerConfig.idTokenSigningAlgValuesSupported)) {
        throw new Error("The OIDC issuer discovery profile is missing the 'id_token_signing_alg_values_supported' value, which is mandatory.");
    }
    const signingAlg = (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.determineSigningAlg)(issuerConfig.idTokenSigningAlgValuesSupported, _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.PREFERRED_SIGNING_ALG);
    const config = {
        client_name: options.clientName,
        application_type: "web",
        redirect_uris: [(_a = options.redirectUrl) === null || _a === void 0 ? void 0 : _a.toString()],
        subject_type: "public",
        token_endpoint_auth_method: "client_secret_basic",
        id_token_signed_response_alg: signingAlg,
        grant_types: ["authorization_code", "refresh_token"],
    };
    const headers = {
        "Content-Type": "application/json",
    };
    const registerResponse = await fetch(issuerConfig.registrationEndpoint.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(config),
    });
    if (registerResponse.ok) {
        const responseBody = await registerResponse.json();
        validateRegistrationResponse(responseBody, options);
        return {
            clientId: responseBody.client_id,
            clientSecret: responseBody.client_secret,
            idTokenSignedResponseAlg: responseBody.id_token_signed_response_alg,
            clientType: "dynamic",
        };
    }
    if (registerResponse.status === 400) {
        processErrorResponse(await registerResponse.json(), options);
    }
    throw new Error(`Dynamic client registration failed: the server returned ${registerResponse.status} ${registerResponse.statusText} - ${await registerResponse.text()}`);
}

function hasError(value) {
    return value.error !== undefined && typeof value.error === "string";
}
function hasErrorDescription(value) {
    return (value.error_description !== undefined &&
        typeof value.error_description === "string");
}
function hasErrorUri(value) {
    return value.error_uri !== undefined && typeof value.error_uri === "string";
}
function hasAccessToken(value) {
    return (value.access_token !== undefined && typeof value.access_token === "string");
}
function hasIdToken(value) {
    return value.id_token !== undefined && typeof value.id_token === "string";
}
function hasRefreshToken(value) {
    return (value.refresh_token !== undefined && typeof value.refresh_token === "string");
}
function hasTokenType(value) {
    return value.token_type !== undefined && typeof value.token_type === "string";
}
function hasExpiresIn(value) {
    return value.expires_in === undefined || typeof value.expires_in === "number";
}
function validatePreconditions(issuer, data) {
    if (data.grantType &&
        (!issuer.grantTypesSupported ||
            !issuer.grantTypesSupported.includes(data.grantType))) {
        throw new Error(`The issuer [${issuer.issuer}] does not support the [${data.grantType}] grant`);
    }
    if (!issuer.tokenEndpoint) {
        throw new Error(`This issuer [${issuer.issuer}] does not have a token endpoint`);
    }
}
function validateTokenEndpointResponse(tokenResponse, dpop) {
    if (hasError(tokenResponse)) {
        throw new _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.OidcProviderError(`Token endpoint returned error [${tokenResponse.error}]${hasErrorDescription(tokenResponse)
            ? `: ${tokenResponse.error_description}`
            : ""}${hasErrorUri(tokenResponse) ? ` (see ${tokenResponse.error_uri})` : ""}`, tokenResponse.error, hasErrorDescription(tokenResponse)
            ? tokenResponse.error_description
            : undefined);
    }
    if (!hasAccessToken(tokenResponse)) {
        throw new _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.InvalidResponseError(["access_token"]);
    }
    if (!hasIdToken(tokenResponse)) {
        throw new _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.InvalidResponseError(["id_token"]);
    }
    if (!hasTokenType(tokenResponse)) {
        throw new _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.InvalidResponseError(["token_type"]);
    }
    if (!hasExpiresIn(tokenResponse)) {
        throw new _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.InvalidResponseError(["expires_in"]);
    }
    if (!dpop && tokenResponse.token_type.toLowerCase() !== "bearer") {
        throw new Error(`Invalid token endpoint response: requested a [Bearer] token, but got a 'token_type' value of [${tokenResponse.token_type}].`);
    }
    return tokenResponse;
}
async function getTokens(issuer, client, data, dpop) {
    validatePreconditions(issuer, data);
    const headers = {
        "content-type": "application/x-www-form-urlencoded",
    };
    let dpopKey;
    if (dpop) {
        dpopKey = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.generateDpopKeyPair)();
        headers.DPoP = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.createDpopHeader)(issuer.tokenEndpoint, "POST", dpopKey);
    }
    if (client.clientSecret) {
        headers.Authorization = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`;
    }
    const requestBody = {
        grant_type: data.grantType,
        redirect_uri: data.redirectUrl,
        code: data.code,
        code_verifier: data.codeVerifier,
        client_id: client.clientId,
    };
    const tokenRequestInit = {
        method: "POST",
        headers,
        body: new URLSearchParams(requestBody).toString(),
    };
    const rawTokenResponse = await (0,_inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__.fetch)(issuer.tokenEndpoint, tokenRequestInit);
    const jsonTokenResponse = (await rawTokenResponse.json());
    const tokenResponse = validateTokenEndpointResponse(jsonTokenResponse, dpop);
    const webId = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.getWebidFromTokenPayload)(tokenResponse.id_token, issuer.jwksUri, issuer.issuer, client.clientId);
    return {
        accessToken: tokenResponse.access_token,
        idToken: tokenResponse.id_token,
        refreshToken: hasRefreshToken(tokenResponse)
            ? tokenResponse.refresh_token
            : undefined,
        webId,
        dpopKey,
        expiresIn: tokenResponse.expires_in,
    };
}
async function importDpopToken(storedTokens) {
    var _a;
    let dpopKey;
    if (storedTokens['dpopKey'] && storedTokens['dpopKey']['publicKey'] && storedTokens['dpopKey']['privateKeyJWK']) {
        dpopKey = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.importDpopKeyPair)(storedTokens['dpopKey']['publicKey'], storedTokens['dpopKey']['privateKeyJWK']);
    }
    return {
        accessToken: storedTokens['accessToken'],
        idToken: storedTokens['idToken'],
        refreshToken: (_a = storedTokens['tokenResponse']) !== null && _a !== void 0 ? _a : undefined,
        webId: storedTokens['webId'],
        dpopKey,
        expiresIn: storedTokens['expiresIn'],
    };
}
async function getBearerToken(redirectUrl) {
    let signinResponse;
    try {
        const client = new _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.OidcClient({
            response_mode: "query",
            loadUserInfo: false,
        });
        signinResponse = await client.processSigninResponse(redirectUrl);
        if (client.settings.metadata === undefined) {
            throw new Error("Cannot retrieve issuer metadata from client information in storage.");
        }
        if (client.settings.metadata.jwks_uri === undefined) {
            throw new Error("Missing some issuer metadata from client information in storage: 'jwks_uri' is undefined");
        }
        if (client.settings.metadata.issuer === undefined) {
            throw new Error("Missing some issuer metadata from client information in storage: 'issuer' is undefined");
        }
        if (client.settings.client_id === undefined) {
            throw new Error("Missing some client information in storage: 'client_id' is undefined");
        }
        const webId = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.getWebidFromTokenPayload)(signinResponse.id_token, client.settings.metadata.jwks_uri, client.settings.metadata.issuer, client.settings.client_id);
        return {
            accessToken: signinResponse.access_token,
            idToken: signinResponse.id_token,
            webId,
            refreshToken: signinResponse.refresh_token,
        };
    }
    catch (err) {
        throw new Error(`Problem handling Auth Code Grant (Flow) redirect - URL [${redirectUrl}]: ${err}`);
    }
}
async function getDpopToken(issuer, client, data) {
    return getTokens(issuer, client, data, true);
}

const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch (_a) {
        return false;
    }
};
async function refresh(refreshToken, issuer, client, dpopKey) {
    if (client.clientId === undefined) {
        throw new Error("No client ID available when trying to refresh the access token.");
    }
    const requestBody = {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: _inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.DEFAULT_SCOPES,
    };
    let dpopHeader = {};
    if (dpopKey !== undefined) {
        dpopHeader = {
            DPoP: await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.createDpopHeader)(issuer.tokenEndpoint, "POST", dpopKey),
        };
    }
    let authHeader = {};
    if (client.clientSecret !== undefined) {
        authHeader = {
            Authorization: `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`,
        };
    }
    else if (isValidUrl(client.clientId)) {
        requestBody.client_id = client.clientId;
    }
    const rawResponse = await (0,_inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__.fetch)(issuer.tokenEndpoint, {
        method: "POST",
        body: new URLSearchParams(requestBody).toString(),
        headers: {
            ...dpopHeader,
            ...authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    let response;
    try {
        response = await rawResponse.json();
    }
    catch (e) {
        throw new Error(`The token endpoint of issuer ${issuer.issuer} returned a malformed response.`);
    }
    const validatedResponse = validateTokenEndpointResponse(response, dpopKey !== undefined);
    const webId = await (0,_inrupt_solid_client_authn_core__WEBPACK_IMPORTED_MODULE_1__.getWebidFromTokenPayload)(validatedResponse.id_token, issuer.jwksUri, issuer.issuer, client.clientId);
    return {
        accessToken: validatedResponse.access_token,
        idToken: validatedResponse.id_token,
        refreshToken: typeof validatedResponse.refresh_token === "string"
            ? validatedResponse.refresh_token
            : undefined,
        webId,
        dpopKey,
        expiresIn: validatedResponse.expires_in,
    };
}

function removeOidcQueryParam(redirectUrl) {
    const cleanedUrl = new URL(redirectUrl);
    cleanedUrl.searchParams.delete("code");
    cleanedUrl.searchParams.delete("state");
    cleanedUrl.hash = "";
    if (redirectUrl.includes(`${cleanedUrl.origin}/`)) {
        return cleanedUrl.href;
    }
    return `${cleanedUrl.origin}${cleanedUrl.href.substring(cleanedUrl.origin.length + 1)}`;
}
async function clearOidcPersistentStorage() {
    const client = new _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.OidcClient({
        response_mode: "query",
    });
    if (window.localStorage) {
        await client.clearStaleState(new _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.WebStorageStateStore({}));
    }
    else {
        await client.clearStaleState(new _inrupt_oidc_client__WEBPACK_IMPORTED_MODULE_0__.WebStorageStateStore({ store: window.sessionStorage }));
    }
    const myStorage = window.localStorage
        ? window.localStorage
        : window.sessionStorage;
    const itemsToRemove = [];
    for (let i = 0; i <= myStorage.length; i += 1) {
        const key = myStorage.key(i);
        if (key &&
            (key.match(/^oidc\..+$/) ||
                key.match(/^solidClientAuthenticationUser:.+$/))) {
            itemsToRemove.push(key);
        }
    }
    itemsToRemove.forEach((key) => myStorage.removeItem(key));
}




/***/ }),

/***/ "../oidc-browser/node_modules/@inrupt/oidc-client/lib/oidc-client.min.js":
/*!*******************************************************************************!*\
  !*** ../oidc-browser/node_modules/@inrupt/oidc-client/lib/oidc-client.min.js ***!
  \*******************************************************************************/
/***/ (function(module) {

!function t(e,r){if(true)module.exports=r();else { var i, n; }}(this,(function(){return function(t){var e={};function r(n){if(e[n])return e[n].exports;var i=e[n]={i:n,l:!1,exports:{}};return t[n].call(i.exports,i,i.exports,r),i.l=!0,i.exports}return r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n})},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.t=function(t,e){if(1&e&&(t=r(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var i in t)r.d(n,i,function(e){return t[e]}.bind(null,i));return n},r.n=function(t){var e=t&&t.__esModule?function e(){return t.default}:function e(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=22)}([function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}();var i={debug:function t(){},info:function t(){},warn:function t(){},error:function t(){}},o=void 0,s=void 0;(e.Log=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.reset=function t(){s=3,o=i},t.debug=function t(){if(s>=4){for(var e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];o.debug.apply(o,Array.from(r))}},t.info=function t(){if(s>=3){for(var e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];o.info.apply(o,Array.from(r))}},t.warn=function t(){if(s>=2){for(var e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];o.warn.apply(o,Array.from(r))}},t.error=function t(){if(s>=1){for(var e=arguments.length,r=Array(e),n=0;n<e;n++)r[n]=arguments[n];o.error.apply(o,Array.from(r))}},n(t,null,[{key:"NONE",get:function t(){return 0}},{key:"ERROR",get:function t(){return 1}},{key:"WARN",get:function t(){return 2}},{key:"INFO",get:function t(){return 3}},{key:"DEBUG",get:function t(){return 4}},{key:"level",get:function t(){return s},set:function t(e){if(!(0<=e&&e<=4))throw new Error("Invalid log level");s=e}},{key:"logger",get:function t(){return o},set:function t(e){if(!e.debug&&e.info&&(e.debug=e.info),!(e.debug&&e.info&&e.warn&&e.error))throw new Error("Invalid logger");o=e}}]),t}()).reset()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}();var i={setInterval:function(t){function e(e,r){return t.apply(this,arguments)}return e.toString=function(){return t.toString()},e}((function(t,e){return setInterval(t,e)})),clearInterval:function(t){function e(e){return t.apply(this,arguments)}return e.toString=function(){return t.toString()},e}((function(t){return clearInterval(t)}))},o=!1;e.Global=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t._testing=function t(){o=!0},t.setXMLHttpRequest=function t(e){e},n(t,null,[{key:"location",get:function t(){if(!o)return location}},{key:"localStorage",get:function t(){if(!o&&"undefined"!=typeof window)return localStorage}},{key:"sessionStorage",get:function t(){if(!o&&"undefined"!=typeof window)return sessionStorage}},{key:"XMLHttpRequest",get:function t(){return null}},{key:"timer",get:function t(){if(!o)return i}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.MetadataService=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(7);function s(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var a=".well-known/openid-configuration";e.MetadataService=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:o.JsonService;if(s(this,t),!e)throw i.Log.error("MetadataService: No settings passed to MetadataService"),new Error("settings");this._settings=e,this._jsonService=new r(["application/jwk-set+json"])}return t.prototype.resetSigningKeys=function t(){this._settings=this._settings||{},this._settings.signingKeys=void 0},t.prototype.getMetadata=function t(){var e=this;return this._settings.metadata?(i.Log.debug("MetadataService.getMetadata: Returning metadata from settings"),Promise.resolve(this._settings.metadata)):this.metadataUrl?(i.Log.debug("MetadataService.getMetadata: getting metadata from",this.metadataUrl),this._jsonService.getJson(this.metadataUrl).then((function(t){i.Log.debug("MetadataService.getMetadata: json received");var r=e._settings.metadataSeed||{};return e._settings.metadata=Object.assign({},r,t),e._settings.metadata}))):(i.Log.error("MetadataService.getMetadata: No authority or metadataUrl configured on settings"),Promise.reject(new Error("No authority or metadataUrl configured on settings")))},t.prototype.getIssuer=function t(){return this._getMetadataProperty("issuer")},t.prototype.getAuthorizationEndpoint=function t(){return this._getMetadataProperty("authorization_endpoint")},t.prototype.getUserInfoEndpoint=function t(){return this._getMetadataProperty("userinfo_endpoint")},t.prototype.getTokenEndpoint=function t(){var e=!(arguments.length>0&&void 0!==arguments[0])||arguments[0];return this._getMetadataProperty("token_endpoint",e)},t.prototype.getCheckSessionIframe=function t(){return this._getMetadataProperty("check_session_iframe",!0)},t.prototype.getEndSessionEndpoint=function t(){return this._getMetadataProperty("end_session_endpoint",!0)},t.prototype.getRevocationEndpoint=function t(){return this._getMetadataProperty("revocation_endpoint",!0)},t.prototype.getKeysEndpoint=function t(){return this._getMetadataProperty("jwks_uri",!0)},t.prototype._getMetadataProperty=function t(e){var r=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return i.Log.debug("MetadataService.getMetadataProperty for: "+e),this.getMetadata().then((function(t){if(i.Log.debug("MetadataService.getMetadataProperty: metadata recieved"),void 0===t[e]){if(!0===r)return void i.Log.warn("MetadataService.getMetadataProperty: Metadata does not contain optional property "+e);throw i.Log.error("MetadataService.getMetadataProperty: Metadata does not contain property "+e),new Error("Metadata does not contain property "+e)}return t[e]}))},t.prototype.getSigningKeys=function t(){var e=this;return this._settings.signingKeys?(i.Log.debug("MetadataService.getSigningKeys: Returning signingKeys from settings"),Promise.resolve(this._settings.signingKeys)):this._getMetadataProperty("jwks_uri").then((function(t){return i.Log.debug("MetadataService.getSigningKeys: jwks_uri received",t),e._jsonService.getJson(t).then((function(t){if(i.Log.debug("MetadataService.getSigningKeys: key set received",t),!t.keys)throw i.Log.error("MetadataService.getSigningKeys: Missing keys on keyset"),new Error("Missing keys on keyset");return e._settings.signingKeys=t.keys,e._settings.signingKeys}))}))},n(t,[{key:"metadataUrl",get:function t(){return this._metadataUrl||(this._settings.metadataUrl?this._metadataUrl=this._settings.metadataUrl:(this._metadataUrl=this._settings.authority,this._metadataUrl&&this._metadataUrl.indexOf(a)<0&&("/"!==this._metadataUrl[this._metadataUrl.length-1]&&(this._metadataUrl+="/"),this._metadataUrl+=a))),this._metadataUrl}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.UrlUtility=void 0;var n=r(0),i=r(1);e.UrlUtility=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.addQueryParam=function t(e,r,n){return e.indexOf("?")<0&&(e+="?"),"?"!==e[e.length-1]&&(e+="&"),e+=encodeURIComponent(r),e+="=",e+=encodeURIComponent(n)},t.parseUrlFragment=function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"#",o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:i.Global;"string"!=typeof e&&(e=o.location.href);var s=e.lastIndexOf(r);s>=0&&(e=e.substr(s+1)),"?"===r&&(s=e.indexOf("#"))>=0&&(e=e.substr(0,s));for(var a,u={},c=/([^&=]+)=([^&]*)/g,h=0;a=c.exec(e);)if(u[decodeURIComponent(a[1])]=decodeURIComponent(a[2].replace(/\+/g," ")),h++>50)return n.Log.error("UrlUtility.parseUrlFragment: response exceeded expected number of parameters",e),{error:"Response exceeded expected number of parameters"};for(var l in u)return u;return{}},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.JoseUtil=void 0;var n=r(26),i=function o(t){return t&&t.__esModule?t:{default:t}}(r(33));e.JoseUtil=(0,i.default)({jws:n.jws,KeyUtil:n.KeyUtil,X509:n.X509,crypto:n.crypto,hextob64u:n.hextob64u,b64tohex:n.b64tohex,AllowedSigningAlgs:n.AllowedSigningAlgs})},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.OidcClientSettings=void 0;var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),o=r(0),s=r(23),a=r(6),u=r(24),c=r(2);function h(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var l=".well-known/openid-configuration",f="id_token",g="openid",d="client_secret_post";e.OidcClientSettings=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=e.authority,i=e.metadataUrl,o=e.metadata,l=e.signingKeys,p=e.metadataSeed,v=e.client_id,y=e.client_secret,m=e.response_type,_=void 0===m?f:m,S=e.scope,w=void 0===S?g:S,b=e.redirect_uri,F=e.post_logout_redirect_uri,E=e.client_authentication,x=void 0===E?d:E,A=e.prompt,k=e.display,P=e.max_age,C=e.ui_locales,T=e.acr_values,R=e.resource,I=e.response_mode,D=e.filterProtocolClaims,N=void 0===D||D,L=e.loadUserInfo,U=void 0===L||L,B=e.staleStateAge,O=void 0===B?900:B,j=e.clockSkew,M=void 0===j?300:j,H=e.clockService,V=void 0===H?new s.ClockService:H,K=e.userInfoJwtIssuer,q=void 0===K?"OP":K,J=e.mergeClaims,W=void 0!==J&&J,z=e.stateStore,Y=void 0===z?new a.WebStorageStateStore:z,G=e.ResponseValidatorCtor,X=void 0===G?u.ResponseValidator:G,$=e.MetadataServiceCtor,Q=void 0===$?c.MetadataService:$,Z=e.extraQueryParams,tt=void 0===Z?{}:Z,et=e.extraTokenParams,rt=void 0===et?{}:et;h(this,t),this._authority=r,this._metadataUrl=i,this._metadata=o,this._metadataSeed=p,this._signingKeys=l,this._client_id=v,this._client_secret=y,this._response_type=_,this._scope=w,this._redirect_uri=b,this._post_logout_redirect_uri=F,this._client_authentication=x,this._prompt=A,this._display=k,this._max_age=P,this._ui_locales=C,this._acr_values=T,this._resource=R,this._response_mode=I,this._filterProtocolClaims=!!N,this._loadUserInfo=!!U,this._staleStateAge=O,this._clockSkew=M,this._clockService=V,this._userInfoJwtIssuer=q,this._mergeClaims=!!W,this._stateStore=Y,this._validator=new X(this),this._metadataService=new Q(this),this._extraQueryParams="object"===(void 0===tt?"undefined":n(tt))?tt:{},this._extraTokenParams="object"===(void 0===rt?"undefined":n(rt))?rt:{}}return t.prototype.getEpochTime=function t(){return this._clockService.getEpochTime()},i(t,[{key:"client_id",get:function t(){return this._client_id},set:function t(e){if(this._client_id)throw o.Log.error("OidcClientSettings.set_client_id: client_id has already been assigned."),new Error("client_id has already been assigned.");this._client_id=e}},{key:"client_secret",get:function t(){return this._client_secret}},{key:"response_type",get:function t(){return this._response_type}},{key:"scope",get:function t(){return this._scope}},{key:"redirect_uri",get:function t(){return this._redirect_uri}},{key:"post_logout_redirect_uri",get:function t(){return this._post_logout_redirect_uri}},{key:"client_authentication",get:function t(){return this._client_authentication}},{key:"prompt",get:function t(){return this._prompt}},{key:"display",get:function t(){return this._display}},{key:"max_age",get:function t(){return this._max_age}},{key:"ui_locales",get:function t(){return this._ui_locales}},{key:"acr_values",get:function t(){return this._acr_values}},{key:"resource",get:function t(){return this._resource}},{key:"response_mode",get:function t(){return this._response_mode}},{key:"authority",get:function t(){return this._authority},set:function t(e){if(this._authority)throw o.Log.error("OidcClientSettings.set_authority: authority has already been assigned."),new Error("authority has already been assigned.");this._authority=e}},{key:"metadataUrl",get:function t(){return this._metadataUrl||(this._metadataUrl=this.authority,this._metadataUrl&&this._metadataUrl.indexOf(l)<0&&("/"!==this._metadataUrl[this._metadataUrl.length-1]&&(this._metadataUrl+="/"),this._metadataUrl+=l)),this._metadataUrl}},{key:"metadata",get:function t(){return this._metadata},set:function t(e){this._metadata=e}},{key:"metadataSeed",get:function t(){return this._metadataSeed},set:function t(e){this._metadataSeed=e}},{key:"signingKeys",get:function t(){return this._signingKeys},set:function t(e){this._signingKeys=e}},{key:"filterProtocolClaims",get:function t(){return this._filterProtocolClaims}},{key:"loadUserInfo",get:function t(){return this._loadUserInfo}},{key:"staleStateAge",get:function t(){return this._staleStateAge}},{key:"clockSkew",get:function t(){return this._clockSkew}},{key:"userInfoJwtIssuer",get:function t(){return this._userInfoJwtIssuer}},{key:"mergeClaims",get:function t(){return this._mergeClaims}},{key:"stateStore",get:function t(){return this._stateStore}},{key:"validator",get:function t(){return this._validator}},{key:"metadataService",get:function t(){return this._metadataService}},{key:"extraQueryParams",get:function t(){return this._extraQueryParams},set:function t(e){"object"===(void 0===e?"undefined":n(e))?this._extraQueryParams=e:this._extraQueryParams={}}},{key:"extraTokenParams",get:function t(){return this._extraTokenParams},set:function t(e){"object"===(void 0===e?"undefined":n(e))?this._extraTokenParams=e:this._extraTokenParams={}}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.WebStorageStateStore=void 0;var n=r(0),i=r(1);function o(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.WebStorageStateStore=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=e.prefix,n=void 0===r?"oidc.":r,s=e.store,a=void 0===s?i.Global.localStorage:s;o(this,t),this._store=a,this._prefix=n}return t.prototype.set=function t(e,r){return n.Log.debug("WebStorageStateStore.set",e),e=this._prefix+e,this._store.setItem(e,r),Promise.resolve()},t.prototype.get=function t(e){n.Log.debug("WebStorageStateStore.get",e),e=this._prefix+e;var r=this._store.getItem(e);return Promise.resolve(r)},t.prototype.remove=function t(e){n.Log.debug("WebStorageStateStore.remove",e),e=this._prefix+e;var r=this._store.getItem(e);return this._store.removeItem(e),Promise.resolve(r)},t.prototype.getAllKeys=function t(){n.Log.debug("WebStorageStateStore.getAllKeys");for(var e=[],r=0;r<this._store.length;r++){var i=this._store.key(r);0===i.indexOf(this._prefix)&&e.push(i.substr(this._prefix.length))}return Promise.resolve(e)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.JsonService=void 0;var n=r(0);r(1);function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.JsonService=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:null,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;i(this,t),e&&Array.isArray(e)?this._contentTypes=e.slice():this._contentTypes=[],this._contentTypes.push("application/json"),r&&this._contentTypes.push("application/jwt"),this._jwtHandler=r}return t.prototype.getJson=async function t(e,r){if(!e)throw n.Log.error("JsonService.getJson: No url passed"),new Error("url");n.Log.debug("JsonService.getJson, url: ",e);var i=this._contentTypes,o=this._jwtHandler,s={method:"GET",headers:{}};r&&(s.headers.Authorization="Bearer "+r,n.Log.debug("JsonService.getJson: token passed, setting Authorization header"));var a=await fetch(e,s);if(a.ok&&200==a.status){var u=a.headers.get("Content-Type");if(u){var c=null,h=!0,l=!1,f=void 0;try{for(var g,d=i[Symbol.iterator]();!(h=(g=d.next()).done);h=!0){var p=g.value;if(u.startsWith(p)){c=p;break}}}catch(t){l=!0,f=t}finally{try{!h&&d.return&&d.return()}finally{if(l)throw f}}if("application/jwt"===c){var v={responseText:await a.text()};return await o(v)}if(c)try{return await a.json()}catch(t){throw n.Log.error("JsonService.getJson: Error parsing JSON response ",t.message),t}throw new Error("Invalid response Content-Type: "+u+", from URL: "+e)}}throw new Error(a.statusText+" ("+a.status+")")},t.prototype.postForm=async function t(e,r,i){if(!e)throw n.Log.error("JsonService.postForm: No url passed"),new Error("url");n.Log.debug("JsonService.postForm, url: ",e);var o=this._contentTypes,s={method:"POST",headers:{},body:""};s.headers["Content-Type"]="application/x-www-form-urlencoded",void 0!==i&&(s.headers.Authorization="Basic "+btoa(i));var a=new URLSearchParams;for(var u in r)a.append(u,r[u]);s.body=a.toString();var c=await fetch(e,s);if(c.ok&&200==c.status){var h=c.headers.get("Content-Type");if(h){var l=null,f=!0,g=!1,d=void 0;try{for(var p,v=o[Symbol.iterator]();!(f=(p=v.next()).done);f=!0){var y=p.value;if(h.startsWith(y)){l=y;break}}}catch(t){g=!0,d=t}finally{try{!f&&v.return&&v.return()}finally{if(g)throw d}}if(l)try{return await c.json()}catch(t){throw new Error("JsonService.postForm: Error parsing JSON response "+t.message)}throw new Error("Invalid response Content-Type: "+h+", from URL: "+e)}}if(400===c.status){var m=c.headers.get("Content-Type");if(m){var _=null,S=!0,w=!1,b=void 0;try{for(var F,E=o[Symbol.iterator]();!(S=(F=E.next()).done);S=!0){var x=F.value;if(m.startsWith(x)){_=x;break}}}catch(t){w=!0,b=t}finally{try{!S&&E.return&&E.return()}finally{if(w)throw b}}if(_)try{if((r=await c.json())&&r.error)throw n.Log.error("JsonService.postForm: Error from server: ",r.error),new Error(r.error)}catch(t){throw n.Log.error("JsonService.postForm: Error parsing JSON response: ",t.message),t}}}throw new Error(c.statusText+" ("+c.status+")")},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SigninRequest=void 0;var n=r(0),i=r(3),o=r(13);e.SigninRequest=function(){function t(e){var r=e.url,s=e.client_id,a=e.redirect_uri,u=e.response_type,c=e.scope,h=e.authority,l=e.data,f=e.prompt,g=e.display,d=e.max_age,p=e.ui_locales,v=e.id_token_hint,y=e.login_hint,m=e.acr_values,_=e.resource,S=e.response_mode,w=e.request,b=e.request_uri,F=e.extraQueryParams,E=e.request_type,x=e.client_secret,A=e.extraTokenParams,k=e.skipUserInfo;if(function P(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),!r)throw n.Log.error("SigninRequest.ctor: No url passed"),new Error("url");if(!s)throw n.Log.error("SigninRequest.ctor: No client_id passed"),new Error("client_id");if(!a)throw n.Log.error("SigninRequest.ctor: No redirect_uri passed"),new Error("redirect_uri");if(!u)throw n.Log.error("SigninRequest.ctor: No response_type passed"),new Error("response_type");if(!c)throw n.Log.error("SigninRequest.ctor: No scope passed"),new Error("scope");if(!h)throw n.Log.error("SigninRequest.ctor: No authority passed"),new Error("authority");var C=t.isOidc(u),T=t.isCode(u);S||(S=t.isCode(u)?"query":null),this.state=new o.SigninState({nonce:C,data:l,client_id:s,authority:h,redirect_uri:a,code_verifier:T,request_type:E,response_mode:S,client_secret:x,scope:c,extraTokenParams:A,skipUserInfo:k}),r=i.UrlUtility.addQueryParam(r,"client_id",s),r=i.UrlUtility.addQueryParam(r,"redirect_uri",a),r=i.UrlUtility.addQueryParam(r,"response_type",u),r=i.UrlUtility.addQueryParam(r,"scope",c),r=i.UrlUtility.addQueryParam(r,"state",this.state.id),C&&(r=i.UrlUtility.addQueryParam(r,"nonce",this.state.nonce)),T&&(r=i.UrlUtility.addQueryParam(r,"code_challenge",this.state.code_challenge),r=i.UrlUtility.addQueryParam(r,"code_challenge_method","S256"));var R={prompt:f,display:g,max_age:d,ui_locales:p,id_token_hint:v,login_hint:y,acr_values:m,resource:_,request:w,request_uri:b,response_mode:S};for(var I in R)R[I]&&(r=i.UrlUtility.addQueryParam(r,I,R[I]));for(var D in F)r=i.UrlUtility.addQueryParam(r,D,F[D]);this.url=r}return t.isOidc=function t(e){return!!e.split(/\s+/g).filter((function(t){return"id_token"===t}))[0]},t.isOAuth=function t(e){return!!e.split(/\s+/g).filter((function(t){return"token"===t}))[0]},t.isCode=function t(e){return!!e.split(/\s+/g).filter((function(t){return"code"===t}))[0]},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.State=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=function s(t){return t&&t.__esModule?t:{default:t}}(r(14));function a(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.State=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=e.id,n=e.data,i=e.created,s=e.request_type;a(this,t),this._id=r||(0,o.default)(),this._data=n,this._created="number"==typeof i&&i>0?i:parseInt(Date.now()/1e3),this._request_type=s}return t.prototype.toStorageString=function t(){return i.Log.debug("State.toStorageString"),JSON.stringify({id:this.id,data:this.data,created:this.created,request_type:this.request_type})},t.fromStorageString=function e(r){return i.Log.debug("State.fromStorageString"),new t(JSON.parse(r))},t.clearStaleState=function e(r,n){var o=Date.now()/1e3-n;return r.getAllKeys().then((function(e){i.Log.debug("State.clearStaleState: got keys",e);for(var n=[],s=function s(a){var c=e[a];u=r.get(c).then((function(e){var n=!1;if(e)try{var s=t.fromStorageString(e);i.Log.debug("State.clearStaleState: got item from key: ",c,s.created),s.created<=o&&(n=!0)}catch(t){i.Log.error("State.clearStaleState: Error parsing state for key",c,t.message),n=!0}else i.Log.debug("State.clearStaleState: no item in storage for key: ",c),n=!0;if(n)return i.Log.debug("State.clearStaleState: removed item for key: ",c),r.remove(c)})),n.push(u)},a=0;a<e.length;a++){var u;s(a)}return i.Log.debug("State.clearStaleState: waiting on promise count:",n.length),Promise.all(n)}))},n(t,[{key:"id",get:function t(){return this._id}},{key:"data",get:function t(){return this._data}},{key:"created",get:function t(){return this._created}},{key:"request_type",get:function t(){return this._request_type}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.OidcClient=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(5),s=r(12),a=r(8),u=r(34),c=r(35),h=r(36),l=r(13),f=r(9);function g(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.OidcClient=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};g(this,t),e instanceof o.OidcClientSettings?this._settings=e:this._settings=new o.OidcClientSettings(e)}return t.prototype.createSigninRequest=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=r.response_type,o=r.scope,s=r.redirect_uri,u=r.data,c=r.state,h=r.prompt,l=r.display,f=r.max_age,g=r.ui_locales,d=r.id_token_hint,p=r.login_hint,v=r.acr_values,y=r.resource,m=r.request,_=r.request_uri,S=r.response_mode,w=r.extraQueryParams,b=r.extraTokenParams,F=r.request_type,E=r.skipUserInfo,x=arguments[1];i.Log.debug("OidcClient.createSigninRequest");var A=this._settings.client_id;n=n||this._settings.response_type,o=o||this._settings.scope,s=s||this._settings.redirect_uri,h=h||this._settings.prompt,l=l||this._settings.display,f=f||this._settings.max_age,g=g||this._settings.ui_locales,v=v||this._settings.acr_values,y=y||this._settings.resource,S=S||this._settings.response_mode,w=w||this._settings.extraQueryParams,b=b||this._settings.extraTokenParams;var k=this._settings.authority;return a.SigninRequest.isCode(n)&&"code"!==n?Promise.reject(new Error("OpenID Connect hybrid flow is not supported")):this._metadataService.getAuthorizationEndpoint().then((function(t){i.Log.debug("OidcClient.createSigninRequest: Received authorization endpoint",t);var r=new a.SigninRequest({url:t,client_id:A,redirect_uri:s,response_type:n,scope:o,data:u||c,authority:k,prompt:h,display:l,max_age:f,ui_locales:g,id_token_hint:d,login_hint:p,acr_values:v,resource:y,request:m,request_uri:_,extraQueryParams:w,extraTokenParams:b,request_type:F,response_mode:S,client_secret:e._settings.client_secret,skipUserInfo:E}),P=r.state;return(x=x||e._stateStore).set(P.id,P.toStorageString()).then((function(){return r}))}))},t.prototype.readSigninResponseState=function t(e,r){var n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];i.Log.debug("OidcClient.readSigninResponseState");var o="query"===this._settings.response_mode||!this._settings.response_mode&&a.SigninRequest.isCode(this._settings.response_type),s=o?"?":"#",c=new u.SigninResponse(e,s);if(!c.state)return i.Log.error("OidcClient.readSigninResponseState: No state in response"),Promise.reject(new Error("No state in response"));r=r||this._stateStore;var h=n?r.remove.bind(r):r.get.bind(r);return h(c.state).then((function(t){if(!t)throw i.Log.error("OidcClient.readSigninResponseState: No matching state found in storage"),new Error("No matching state found in storage");return{state:l.SigninState.fromStorageString(t),response:c}}))},t.prototype.processSigninResponse=function t(e,r){var n=this;return i.Log.debug("OidcClient.processSigninResponse"),this.readSigninResponseState(e,r,!0).then((function(t){var e=t.state,r=t.response;return i.Log.debug("OidcClient.processSigninResponse: Received state from storage; validating response"),n._validator.validateSigninResponse(e,r)}))},t.prototype.createSignoutRequest=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=r.id_token_hint,o=r.data,s=r.state,a=r.post_logout_redirect_uri,u=r.extraQueryParams,h=r.request_type,l=arguments[1];return i.Log.debug("OidcClient.createSignoutRequest"),a=a||this._settings.post_logout_redirect_uri,u=u||this._settings.extraQueryParams,this._metadataService.getEndSessionEndpoint().then((function(t){if(!t)throw i.Log.error("OidcClient.createSignoutRequest: No end session endpoint url returned"),new Error("no end session endpoint");i.Log.debug("OidcClient.createSignoutRequest: Received end session endpoint",t);var r=new c.SignoutRequest({url:t,id_token_hint:n,post_logout_redirect_uri:a,data:o||s,extraQueryParams:u,request_type:h}),f=r.state;return f&&(i.Log.debug("OidcClient.createSignoutRequest: Signout request has state to persist"),(l=l||e._stateStore).set(f.id,f.toStorageString())),r}))},t.prototype.readSignoutResponseState=function t(e,r){var n=arguments.length>2&&void 0!==arguments[2]&&arguments[2];i.Log.debug("OidcClient.readSignoutResponseState");var o=new h.SignoutResponse(e);if(!o.state)return i.Log.debug("OidcClient.readSignoutResponseState: No state in response"),o.error?(i.Log.warn("OidcClient.readSignoutResponseState: Response was error: ",o.error),Promise.reject(new s.ErrorResponse(o))):Promise.resolve({state:void 0,response:o});var a=o.state;r=r||this._stateStore;var u=n?r.remove.bind(r):r.get.bind(r);return u(a).then((function(t){if(!t)throw i.Log.error("OidcClient.readSignoutResponseState: No matching state found in storage"),new Error("No matching state found in storage");return{state:f.State.fromStorageString(t),response:o}}))},t.prototype.processSignoutResponse=function t(e,r){var n=this;return i.Log.debug("OidcClient.processSignoutResponse"),this.readSignoutResponseState(e,r,!0).then((function(t){var e=t.state,r=t.response;return e?(i.Log.debug("OidcClient.processSignoutResponse: Received state from storage; validating response"),n._validator.validateSignoutResponse(e,r)):(i.Log.debug("OidcClient.processSignoutResponse: No state from storage; skipping validating response"),r)}))},t.prototype.clearStaleState=function t(e){return i.Log.debug("OidcClient.clearStaleState"),e=e||this._stateStore,f.State.clearStaleState(e,this.settings.staleStateAge)},n(t,[{key:"_stateStore",get:function t(){return this.settings.stateStore}},{key:"_validator",get:function t(){return this.settings.validator}},{key:"_metadataService",get:function t(){return this.settings.metadataService}},{key:"settings",get:function t(){return this._settings}},{key:"metadataService",get:function t(){return this._metadataService}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.TokenClient=void 0;var n=r(7),i=r(2),o=r(0);function s(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.TokenClient=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:n.JsonService,a=arguments.length>2&&void 0!==arguments[2]?arguments[2]:i.MetadataService;if(s(this,t),!e)throw o.Log.error("TokenClient.ctor: No settings passed"),new Error("settings");this._settings=e,this._jsonService=new r,this._metadataService=new a(this._settings)}return t.prototype.exchangeCode=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(r=Object.assign({},r)).grant_type=r.grant_type||"authorization_code",r.client_id=r.client_id||this._settings.client_id,r.client_secret=r.client_secret||this._settings.client_secret,r.redirect_uri=r.redirect_uri||this._settings.redirect_uri;var n=void 0,i=r._client_authentication||this._settings._client_authentication;return delete r._client_authentication,r.code?r.redirect_uri?r.code_verifier?r.client_id?r.client_secret||"client_secret_basic"!=i?("client_secret_basic"==i&&(n=r.client_id+":"+r.client_secret,delete r.client_id,delete r.client_secret),this._metadataService.getTokenEndpoint(!1).then((function(t){return o.Log.debug("TokenClient.exchangeCode: Received token endpoint"),e._jsonService.postForm(t,r,n).then((function(t){return o.Log.debug("TokenClient.exchangeCode: response received"),t}))}))):(o.Log.error("TokenClient.exchangeCode: No client_secret passed"),Promise.reject(new Error("A client_secret is required"))):(o.Log.error("TokenClient.exchangeCode: No client_id passed"),Promise.reject(new Error("A client_id is required"))):(o.Log.error("TokenClient.exchangeCode: No code_verifier passed"),Promise.reject(new Error("A code_verifier is required"))):(o.Log.error("TokenClient.exchangeCode: No redirect_uri passed"),Promise.reject(new Error("A redirect_uri is required"))):(o.Log.error("TokenClient.exchangeCode: No code passed"),Promise.reject(new Error("A code is required")))},t.prototype.exchangeRefreshToken=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(r=Object.assign({},r)).grant_type=r.grant_type||"refresh_token",r.client_id=r.client_id||this._settings.client_id,r.client_secret=r.client_secret||this._settings.client_secret;var n=void 0,i=r._client_authentication||this._settings._client_authentication;return delete r._client_authentication,r.refresh_token?r.client_id?("client_secret_basic"==i&&(n=r.client_id+":"+r.client_secret,delete r.client_id,delete r.client_secret),this._metadataService.getTokenEndpoint(!1).then((function(t){return o.Log.debug("TokenClient.exchangeRefreshToken: Received token endpoint"),e._jsonService.postForm(t,r,n).then((function(t){return o.Log.debug("TokenClient.exchangeRefreshToken: response received"),t}))}))):(o.Log.error("TokenClient.exchangeRefreshToken: No client_id passed"),Promise.reject(new Error("A client_id is required"))):(o.Log.error("TokenClient.exchangeRefreshToken: No refresh_token passed"),Promise.reject(new Error("A refresh_token is required")))},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.ErrorResponse=void 0;var n=r(0);function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function o(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}e.ErrorResponse=function(t){function e(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},s=r.error,a=r.error_description,u=r.error_uri,c=r.state,h=r.session_state;if(i(this,e),!s)throw n.Log.error("No error passed to ErrorResponse"),new Error("error");var l=o(this,t.call(this,a||s));return l.name="ErrorResponse",l.error=s,l.error_description=a,l.error_uri=u,l.state=c,l.session_state=h,l}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),e}(Error)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SigninState=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(9),s=r(4),a=function u(t){return t&&t.__esModule?t:{default:t}}(r(14));function c(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function h(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}e.SigninState=function(t){function e(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=r.nonce,i=r.authority,o=r.client_id,u=r.redirect_uri,l=r.code_verifier,f=r.response_mode,g=r.client_secret,d=r.scope,p=r.extraTokenParams,v=r.skipUserInfo;c(this,e);var y=h(this,t.call(this,arguments[0]));if(!0===n?y._nonce=(0,a.default)():n&&(y._nonce=n),!0===l?y._code_verifier=(0,a.default)()+(0,a.default)()+(0,a.default)():l&&(y._code_verifier=l),y.code_verifier){var m=s.JoseUtil.hashString(y.code_verifier,"SHA256");y._code_challenge=s.JoseUtil.hexToBase64Url(m)}return y._redirect_uri=u,y._authority=i,y._client_id=o,y._response_mode=f,y._client_secret=g,y._scope=d,y._extraTokenParams=p,y._skipUserInfo=v,y}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),e.prototype.toStorageString=function t(){return i.Log.debug("SigninState.toStorageString"),JSON.stringify({id:this.id,data:this.data,created:this.created,request_type:this.request_type,nonce:this.nonce,code_verifier:this.code_verifier,redirect_uri:this.redirect_uri,authority:this.authority,client_id:this.client_id,response_mode:this.response_mode,client_secret:this.client_secret,scope:this.scope,extraTokenParams:this.extraTokenParams,skipUserInfo:this.skipUserInfo})},e.fromStorageString=function t(r){return i.Log.debug("SigninState.fromStorageString"),new e(JSON.parse(r))},n(e,[{key:"nonce",get:function t(){return this._nonce}},{key:"authority",get:function t(){return this._authority}},{key:"client_id",get:function t(){return this._client_id}},{key:"redirect_uri",get:function t(){return this._redirect_uri}},{key:"code_verifier",get:function t(){return this._code_verifier}},{key:"code_challenge",get:function t(){return this._code_challenge}},{key:"response_mode",get:function t(){return this._response_mode}},{key:"client_secret",get:function t(){return this._client_secret}},{key:"scope",get:function t(){return this._scope}},{key:"extraTokenParams",get:function t(){return this._extraTokenParams}},{key:"skipUserInfo",get:function t(){return this._skipUserInfo}}]),e}(o.State)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.default=function n(){return("undefined"!=i&&null!==i&&void 0!==i.getRandomValues?o:s)().replace(/-/g,"")};var i="undefined"!=typeof window?window.crypto||window.msCrypto:null;function o(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,(function(t){return(t^i.getRandomValues(new Uint8Array(1))[0]&15>>t/4).toString(16)}))}function s(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,(function(t){return(t^16*Math.random()>>t/4).toString(16)}))}t.exports=e.default},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.User=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0);e.User=function(){function t(e){var r=e.id_token,n=e.session_state,i=e.access_token,o=e.refresh_token,s=e.token_type,a=e.scope,u=e.profile,c=e.expires_at,h=e.state;!function l(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this.id_token=r,this.session_state=n,this.access_token=i,this.refresh_token=o,this.token_type=s,this.scope=a,this.profile=u,this.expires_at=c,this.state=h}return t.prototype.toStorageString=function t(){return i.Log.debug("User.toStorageString"),JSON.stringify({id_token:this.id_token,session_state:this.session_state,access_token:this.access_token,refresh_token:this.refresh_token,token_type:this.token_type,scope:this.scope,profile:this.profile,expires_at:this.expires_at})},t.fromStorageString=function e(r){return i.Log.debug("User.fromStorageString"),new t(JSON.parse(r))},n(t,[{key:"expires_in",get:function t(){if(this.expires_at){var e=parseInt(Date.now()/1e3);return this.expires_at-e}},set:function t(e){var r=parseInt(e);if("number"==typeof r&&r>0){var n=parseInt(Date.now()/1e3);this.expires_at=n+r}}},{key:"expired",get:function t(){var e=this.expires_in;if(void 0!==e)return e<=0}},{key:"scopes",get:function t(){return(this.scope||"").split(" ")}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.AccessTokenEvents=void 0;var n=r(0),i=r(46);function o(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.AccessTokenEvents=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=e.accessTokenExpiringNotificationTime,n=void 0===r?60:r,s=e.accessTokenExpiringTimer,a=void 0===s?new i.Timer("Access token expiring"):s,u=e.accessTokenExpiredTimer,c=void 0===u?new i.Timer("Access token expired"):u;o(this,t),this._accessTokenExpiringNotificationTime=n,this._accessTokenExpiring=a,this._accessTokenExpired=c}return t.prototype.load=function t(e){if(e.access_token&&void 0!==e.expires_in){var r=e.expires_in;if(n.Log.debug("AccessTokenEvents.load: access token present, remaining duration:",r),r>0){var i=r-this._accessTokenExpiringNotificationTime;i<=0&&(i=1),n.Log.debug("AccessTokenEvents.load: registering expiring timer in:",i),this._accessTokenExpiring.init(i)}else n.Log.debug("AccessTokenEvents.load: canceling existing expiring timer becase we're past expiration."),this._accessTokenExpiring.cancel();var o=r+1;n.Log.debug("AccessTokenEvents.load: registering expired timer in:",o),this._accessTokenExpired.init(o)}else this._accessTokenExpiring.cancel(),this._accessTokenExpired.cancel()},t.prototype.unload=function t(){n.Log.debug("AccessTokenEvents.unload: canceling existing access token timers"),this._accessTokenExpiring.cancel(),this._accessTokenExpired.cancel()},t.prototype.addAccessTokenExpiring=function t(e){this._accessTokenExpiring.addHandler(e)},t.prototype.removeAccessTokenExpiring=function t(e){this._accessTokenExpiring.removeHandler(e)},t.prototype.addAccessTokenExpired=function t(e){this._accessTokenExpired.addHandler(e)},t.prototype.removeAccessTokenExpired=function t(e){this._accessTokenExpired.removeHandler(e)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.Event=void 0;var n=r(0);e.Event=function(){function t(e){!function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this._name=e,this._callbacks=[]}return t.prototype.addHandler=function t(e){this._callbacks.push(e)},t.prototype.removeHandler=function t(e){var r=this._callbacks.findIndex((function(t){return t===e}));r>=0&&this._callbacks.splice(r,1)},t.prototype.raise=function t(){n.Log.debug("Event: Raising event: "+this._name);for(var e=0;e<this._callbacks.length;e++){var r;(r=this._callbacks)[e].apply(r,arguments)}},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SessionMonitor=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(19),s=r(1);function a(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.SessionMonitor=function(){function t(e){var r=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:o.CheckSessionIFrame,u=arguments.length>2&&void 0!==arguments[2]?arguments[2]:s.Global.timer;if(a(this,t),!e)throw i.Log.error("SessionMonitor.ctor: No user manager passed to SessionMonitor"),new Error("userManager");this._userManager=e,this._CheckSessionIFrameCtor=n,this._timer=u,this._userManager.events.addUserLoaded(this._start.bind(this)),this._userManager.events.addUserUnloaded(this._stop.bind(this)),Promise.resolve(this._userManager.getUser().then((function(t){t?r._start(t):r._settings.monitorAnonymousSession&&r._userManager.querySessionStatus().then((function(t){var e={session_state:t.session_state};t.sub&&t.sid&&(e.profile={sub:t.sub,sid:t.sid}),r._start(e)})).catch((function(t){i.Log.error("SessionMonitor ctor: error from querySessionStatus:",t.message)}))})).catch((function(t){i.Log.error("SessionMonitor ctor: error from getUser:",t.message)})))}return t.prototype._start=function t(e){var r=this,n=e.session_state;n&&(e.profile?(this._sub=e.profile.sub,this._sid=e.profile.sid,i.Log.debug("SessionMonitor._start: session_state:",n,", sub:",this._sub)):(this._sub=void 0,this._sid=void 0,i.Log.debug("SessionMonitor._start: session_state:",n,", anonymous user")),this._checkSessionIFrame?this._checkSessionIFrame.start(n):this._metadataService.getCheckSessionIframe().then((function(t){if(t){i.Log.debug("SessionMonitor._start: Initializing check session iframe");var e=r._client_id,o=r._checkSessionInterval,s=r._stopCheckSessionOnError;r._checkSessionIFrame=new r._CheckSessionIFrameCtor(r._callback.bind(r),e,t,o,s),r._checkSessionIFrame.load().then((function(){r._checkSessionIFrame.start(n)}))}else i.Log.warn("SessionMonitor._start: No check session iframe found in the metadata")})).catch((function(t){i.Log.error("SessionMonitor._start: Error from getCheckSessionIframe:",t.message)})))},t.prototype._stop=function t(){var e=this;if(this._sub=void 0,this._sid=void 0,this._checkSessionIFrame&&(i.Log.debug("SessionMonitor._stop"),this._checkSessionIFrame.stop()),this._settings.monitorAnonymousSession)var r=this._timer.setInterval((function(){e._timer.clearInterval(r),e._userManager.querySessionStatus().then((function(t){var r={session_state:t.session_state};t.sub&&t.sid&&(r.profile={sub:t.sub,sid:t.sid}),e._start(r)})).catch((function(t){i.Log.error("SessionMonitor: error from querySessionStatus:",t.message)}))}),1e3)},t.prototype._callback=function t(){var e=this;this._userManager.querySessionStatus().then((function(t){var r=!0;t?t.sub===e._sub?(r=!1,e._checkSessionIFrame.start(t.session_state),t.sid===e._sid?i.Log.debug("SessionMonitor._callback: Same sub still logged in at OP, restarting check session iframe; session_state:",t.session_state):(i.Log.debug("SessionMonitor._callback: Same sub still logged in at OP, session state has changed, restarting check session iframe; session_state:",t.session_state),e._userManager.events._raiseUserSessionChanged())):i.Log.debug("SessionMonitor._callback: Different subject signed into OP:",t.sub):i.Log.debug("SessionMonitor._callback: Subject no longer signed into OP"),r&&(e._sub?(i.Log.debug("SessionMonitor._callback: SessionMonitor._callback; raising signed out event"),e._userManager.events._raiseUserSignedOut()):(i.Log.debug("SessionMonitor._callback: SessionMonitor._callback; raising signed in event"),e._userManager.events._raiseUserSignedIn()))})).catch((function(t){e._sub&&(i.Log.debug("SessionMonitor._callback: Error calling queryCurrentSigninSession; raising signed out event",t.message),e._userManager.events._raiseUserSignedOut())}))},n(t,[{key:"_settings",get:function t(){return this._userManager.settings}},{key:"_metadataService",get:function t(){return this._userManager.metadataService}},{key:"_client_id",get:function t(){return this._settings.client_id}},{key:"_checkSessionInterval",get:function t(){return this._settings.checkSessionInterval}},{key:"_stopCheckSessionOnError",get:function t(){return this._settings.stopCheckSessionOnError}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.CheckSessionIFrame=void 0;var n=r(0);function i(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.CheckSessionIFrame=function(){function t(e,r,n,o){var s=!(arguments.length>4&&void 0!==arguments[4])||arguments[4];i(this,t),this._callback=e,this._client_id=r,this._url=n,this._interval=o||2e3,this._stopOnError=s;var a=n.indexOf("/",n.indexOf("//")+2);this._frame_origin=n.substr(0,a),this._frame=window.document.createElement("iframe"),this._frame.style.visibility="hidden",this._frame.style.position="absolute",this._frame.style.display="none",this._frame.width=0,this._frame.height=0,this._frame.src=n}return t.prototype.load=function t(){var e=this;return new Promise((function(t){e._frame.onload=function(){t()},window.document.body.appendChild(e._frame),e._boundMessageEvent=e._message.bind(e),window.addEventListener("message",e._boundMessageEvent,!1)}))},t.prototype._message=function t(e){e.origin===this._frame_origin&&e.source===this._frame.contentWindow&&("error"===e.data?(n.Log.error("CheckSessionIFrame: error message from check session op iframe"),this._stopOnError&&this.stop()):"changed"===e.data?(n.Log.debug("CheckSessionIFrame: changed message from check session op iframe"),this.stop(),this._callback()):n.Log.debug("CheckSessionIFrame: "+e.data+" message from check session op iframe"))},t.prototype.start=function t(e){var r=this;if(this._session_state!==e){n.Log.debug("CheckSessionIFrame.start"),this.stop(),this._session_state=e;var i=function t(){r._frame.contentWindow.postMessage(r._client_id+" "+r._session_state,r._frame_origin)};i(),this._timer=window.setInterval(i,this._interval)}},t.prototype.stop=function t(){this._session_state=null,this._timer&&(n.Log.debug("CheckSessionIFrame.stop"),window.clearInterval(this._timer),this._timer=null)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.TokenRevocationClient=void 0;var n=r(0),i=r(2);r(1);function o(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var s="access_token",a="refresh_token";e.TokenRevocationClient=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:i.MetadataService;if(o(this,t),!e)throw n.Log.error("TokenRevocationClient.ctor: No settings provided"),new Error("No settings provided.");this._settings=e,this._metadataService=new r(this._settings)}return t.prototype.revoke=function t(e,r){var i=this,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"access_token";if(!e)throw n.Log.error("TokenRevocationClient.revoke: No token provided"),new Error("No token provided.");if(o!==s&&o!=a)throw n.Log.error("TokenRevocationClient.revoke: Invalid token type"),new Error("Invalid token type.");return this._metadataService.getRevocationEndpoint().then((function(t){if(t){n.Log.debug("TokenRevocationClient.revoke: Revoking "+o);var s=i._settings.client_id,a=i._settings.client_secret;return i._revoke(t,s,a,e,o)}if(r)throw n.Log.error("TokenRevocationClient.revoke: Revocation not supported"),new Error("Revocation not supported")}))},t.prototype._revoke=async function t(e,r,i,o,s){var a={method:"POST",headers:{},body:""};a.headers["Content-Type"]="application/x-www-form-urlencoded";var u=new URLSearchParams;u.append("client_id",r),i&&u.append("client_secret",i),u.append("token_type_hint",s),u.append("token",o),a.body=u.toString();try{var c=await fetch(e,a);if(n.Log.debug("TokenRevocationClient.revoke: HTTP response received, status",c.status),c.ok&&200==c.status)return;throw new Error(c.statusText+" ("+c.status+")")}catch(t){throw new Error("TokenRevocationClient.revoke: Network Error.",t.message)}},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.CordovaPopupWindow=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0);e.CordovaPopupWindow=function(){function t(e){var r=this;!function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this._promise=new Promise((function(t,e){r._resolve=t,r._reject=e})),this.features=e.popupWindowFeatures||"location=no,toolbar=no,zoom=no",this.target=e.popupWindowTarget||"_blank",this.redirect_uri=e.startUrl,i.Log.debug("CordovaPopupWindow.ctor: redirect_uri: "+this.redirect_uri)}return t.prototype._isInAppBrowserInstalled=function t(e){return["cordova-plugin-inappbrowser","cordova-plugin-inappbrowser.inappbrowser","org.apache.cordova.inappbrowser"].some((function(t){return e.hasOwnProperty(t)}))},t.prototype.navigate=function t(e){if(e&&e.url){if(!window.cordova)return this._error("cordova is undefined");var r=window.cordova.require("cordova/plugin_list").metadata;if(!1===this._isInAppBrowserInstalled(r))return this._error("InAppBrowser plugin not found");this._popup=cordova.InAppBrowser.open(e.url,this.target,this.features),this._popup?(i.Log.debug("CordovaPopupWindow.navigate: popup successfully created"),this._exitCallbackEvent=this._exitCallback.bind(this),this._loadStartCallbackEvent=this._loadStartCallback.bind(this),this._popup.addEventListener("exit",this._exitCallbackEvent,!1),this._popup.addEventListener("loadstart",this._loadStartCallbackEvent,!1)):this._error("Error opening popup window")}else this._error("No url provided");return this.promise},t.prototype._loadStartCallback=function t(e){0===e.url.indexOf(this.redirect_uri)&&this._success({url:e.url})},t.prototype._exitCallback=function t(e){this._error(e)},t.prototype._success=function t(e){this._cleanup(),i.Log.debug("CordovaPopupWindow: Successful response from cordova popup window"),this._resolve(e)},t.prototype._error=function t(e){this._cleanup(),i.Log.error(e),this._reject(new Error(e))},t.prototype.close=function t(){this._cleanup()},t.prototype._cleanup=function t(){this._popup&&(i.Log.debug("CordovaPopupWindow: cleaning up popup"),this._popup.removeEventListener("exit",this._exitCallbackEvent,!1),this._popup.removeEventListener("loadstart",this._loadStartCallbackEvent,!1),this._popup.close()),this._popup=null},n(t,[{key:"promise",get:function t(){return this._promise}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var n=r(0),i=r(10),o=r(5),s=r(6),a=r(37),u=r(38),c=r(16),h=r(2),l=r(48),f=r(49),g=r(19),d=r(20),p=r(18),v=r(1),y=r(15),m=r(50);e.default={Version:m.Version,Log:n.Log,OidcClient:i.OidcClient,OidcClientSettings:o.OidcClientSettings,WebStorageStateStore:s.WebStorageStateStore,InMemoryWebStorage:a.InMemoryWebStorage,UserManager:u.UserManager,AccessTokenEvents:c.AccessTokenEvents,MetadataService:h.MetadataService,CordovaPopupNavigator:l.CordovaPopupNavigator,CordovaIFrameNavigator:f.CordovaIFrameNavigator,CheckSessionIFrame:g.CheckSessionIFrame,TokenRevocationClient:d.TokenRevocationClient,SessionMonitor:p.SessionMonitor,Global:v.Global,User:y.User},t.exports=e.default},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.ClockService=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.getEpochTime=function t(){return Promise.resolve(Date.now()/1e3|0)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.ResponseValidator=void 0;var n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=r(0),o=r(2),s=r(25),a=r(11),u=r(12),c=r(4);function h(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var l=["nonce","at_hash","iat","nbf","exp","aud","iss","c_hash"];e.ResponseValidator=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:o.MetadataService,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:s.UserInfoService,u=arguments.length>3&&void 0!==arguments[3]?arguments[3]:c.JoseUtil,l=arguments.length>4&&void 0!==arguments[4]?arguments[4]:a.TokenClient;if(h(this,t),!e)throw i.Log.error("ResponseValidator.ctor: No settings passed to ResponseValidator"),new Error("settings");this._settings=e,this._metadataService=new r(this._settings),this._userInfoService=new n(this._settings),this._joseUtil=u,this._tokenClient=new l(this._settings)}return t.prototype.validateSigninResponse=function t(e,r){var n=this;return i.Log.debug("ResponseValidator.validateSigninResponse"),this._processSigninParams(e,r).then((function(t){return i.Log.debug("ResponseValidator.validateSigninResponse: state processed"),n._validateTokens(e,t).then((function(t){return i.Log.debug("ResponseValidator.validateSigninResponse: tokens validated"),n._processClaims(e,t).then((function(t){return i.Log.debug("ResponseValidator.validateSigninResponse: claims processed"),t}))}))}))},t.prototype.validateSignoutResponse=function t(e,r){return e.id!==r.state?(i.Log.error("ResponseValidator.validateSignoutResponse: State does not match"),Promise.reject(new Error("State does not match"))):(i.Log.debug("ResponseValidator.validateSignoutResponse: state validated"),r.state=e.data,r.error?(i.Log.warn("ResponseValidator.validateSignoutResponse: Response was error",r.error),Promise.reject(new u.ErrorResponse(r))):Promise.resolve(r))},t.prototype._processSigninParams=function t(e,r){if(e.id!==r.state)return i.Log.error("ResponseValidator._processSigninParams: State does not match"),Promise.reject(new Error("State does not match"));if(!e.client_id)return i.Log.error("ResponseValidator._processSigninParams: No client_id on state"),Promise.reject(new Error("No client_id on state"));if(!e.authority)return i.Log.error("ResponseValidator._processSigninParams: No authority on state"),Promise.reject(new Error("No authority on state"));if(this._settings.authority){if(this._settings.authority&&this._settings.authority!==e.authority)return i.Log.error("ResponseValidator._processSigninParams: authority mismatch on settings vs. signin state"),Promise.reject(new Error("authority mismatch on settings vs. signin state"))}else this._settings.authority=e.authority;if(this._settings.client_id){if(this._settings.client_id&&this._settings.client_id!==e.client_id)return i.Log.error("ResponseValidator._processSigninParams: client_id mismatch on settings vs. signin state"),Promise.reject(new Error("client_id mismatch on settings vs. signin state"))}else this._settings.client_id=e.client_id;return i.Log.debug("ResponseValidator._processSigninParams: state validated"),r.state=e.data,r.error?(i.Log.warn("ResponseValidator._processSigninParams: Response was error",r.error),Promise.reject(new u.ErrorResponse(r))):e.nonce&&!r.id_token?(i.Log.error("ResponseValidator._processSigninParams: Expecting id_token in response"),Promise.reject(new Error("No id_token in response"))):!e.nonce&&r.id_token?(i.Log.error("ResponseValidator._processSigninParams: Not expecting id_token in response"),Promise.reject(new Error("Unexpected id_token in response"))):e.code_verifier&&!r.code?(i.Log.error("ResponseValidator._processSigninParams: Expecting code in response"),Promise.reject(new Error("No code in response"))):!e.code_verifier&&r.code?(i.Log.error("ResponseValidator._processSigninParams: Not expecting code in response"),Promise.reject(new Error("Unexpected code in response"))):(r.scope||(r.scope=e.scope),Promise.resolve(r))},t.prototype._processClaims=function t(e,r){var n=this;if(r.isOpenIdConnect){if(i.Log.debug("ResponseValidator._processClaims: response is OIDC, processing claims"),r.profile=this._filterProtocolClaims(r.profile),!0!==e.skipUserInfo&&this._settings.loadUserInfo&&r.access_token)return i.Log.debug("ResponseValidator._processClaims: loading user info"),this._userInfoService.getClaims(r.access_token).then((function(t){return i.Log.debug("ResponseValidator._processClaims: user info claims received from user info endpoint"),t.sub!==r.profile.sub?(i.Log.error("ResponseValidator._processClaims: sub from user info endpoint does not match sub in id_token"),Promise.reject(new Error("sub from user info endpoint does not match sub in id_token"))):(r.profile=n._mergeClaims(r.profile,t),i.Log.debug("ResponseValidator._processClaims: user info claims received, updated profile:",r.profile),r)}));i.Log.debug("ResponseValidator._processClaims: not loading user info")}else i.Log.debug("ResponseValidator._processClaims: response is not OIDC, not processing claims");return Promise.resolve(r)},t.prototype._mergeClaims=function t(e,r){var i=Object.assign({},e);for(var o in r){var s=r[o];Array.isArray(s)||(s=[s]);for(var a=0;a<s.length;a++){var u=s[a];i[o]?Array.isArray(i[o])?i[o].indexOf(u)<0&&i[o].push(u):i[o]!==u&&("object"===(void 0===u?"undefined":n(u))&&this._settings.mergeClaims?i[o]=this._mergeClaims(i[o],u):i[o]=[i[o],u]):i[o]=u}}return i},t.prototype._filterProtocolClaims=function t(e){i.Log.debug("ResponseValidator._filterProtocolClaims, incoming claims:",e);var r=Object.assign({},e);return this._settings._filterProtocolClaims?(l.forEach((function(t){delete r[t]})),i.Log.debug("ResponseValidator._filterProtocolClaims: protocol claims filtered",r)):i.Log.debug("ResponseValidator._filterProtocolClaims: protocol claims not filtered"),r},t.prototype._validateTokens=function t(e,r){return r.code?(i.Log.debug("ResponseValidator._validateTokens: Validating code"),this._processCode(e,r)):r.id_token?r.access_token?(i.Log.debug("ResponseValidator._validateTokens: Validating id_token and access_token"),this._validateIdTokenAndAccessToken(e,r)):(i.Log.debug("ResponseValidator._validateTokens: Validating id_token"),this._validateIdToken(e,r)):(i.Log.debug("ResponseValidator._validateTokens: No code to process or id_token to validate"),Promise.resolve(r))},t.prototype._processCode=function t(e,r){var o=this,s={client_id:e.client_id,client_secret:e.client_secret,code:r.code,redirect_uri:e.redirect_uri,code_verifier:e.code_verifier};return e.extraTokenParams&&"object"===n(e.extraTokenParams)&&Object.assign(s,e.extraTokenParams),this._tokenClient.exchangeCode(s).then((function(t){for(var n in t)r[n]=t[n];return r.id_token?(i.Log.debug("ResponseValidator._processCode: token response successful, processing id_token"),o._validateIdTokenAttributes(e,r)):(i.Log.debug("ResponseValidator._processCode: token response successful, returning response"),r)}))},t.prototype._validateIdTokenAttributes=function t(e,r){var n=this;return this._metadataService.getIssuer().then((function(t){var o=e.client_id,s=n._settings.clockSkew;return i.Log.debug("ResponseValidator._validateIdTokenAttributes: Validaing JWT attributes; using clock skew (in seconds) of: ",s),n._settings.getEpochTime().then((function(a){return n._joseUtil.validateJwtAttributes(r.id_token,t,o,s,a).then((function(t){return e.nonce&&e.nonce!==t.nonce?(i.Log.error("ResponseValidator._validateIdTokenAttributes: Invalid nonce in id_token"),Promise.reject(new Error("Invalid nonce in id_token"))):t.sub?(r.profile=t,r):(i.Log.error("ResponseValidator._validateIdTokenAttributes: No sub present in id_token"),Promise.reject(new Error("No sub present in id_token")))}))}))}))},t.prototype._validateIdTokenAndAccessToken=function t(e,r){var n=this;return this._validateIdToken(e,r).then((function(t){return n._validateAccessToken(t)}))},t.prototype._getSigningKeyForJwt=function t(e){var r=this;return this._metadataService.getSigningKeys().then((function(t){var n=e.header.kid;if(!t)return i.Log.error("ResponseValidator._validateIdToken: No signing keys from metadata"),Promise.reject(new Error("No signing keys from metadata"));i.Log.debug("ResponseValidator._validateIdToken: Received signing keys");var o=void 0;if(n)o=t.filter((function(t){return t.kid===n}))[0];else{if((t=r._filterByAlg(t,e.header.alg)).length>1)return i.Log.error("ResponseValidator._validateIdToken: No kid found in id_token and more than one key found in metadata"),Promise.reject(new Error("No kid found in id_token and more than one key found in metadata"));o=t[0]}return Promise.resolve(o)}))},t.prototype._getSigningKeyForJwtWithSingleRetry=function t(e){var r=this;return this._getSigningKeyForJwt(e).then((function(t){return t?Promise.resolve(t):(r._metadataService.resetSigningKeys(),r._getSigningKeyForJwt(e))}))},t.prototype._validateIdToken=function t(e,r){var n=this;if(!e.nonce)return i.Log.error("ResponseValidator._validateIdToken: No nonce on state"),Promise.reject(new Error("No nonce on state"));var o=this._joseUtil.parseJwt(r.id_token);return o&&o.header&&o.payload?e.nonce!==o.payload.nonce?(i.Log.error("ResponseValidator._validateIdToken: Invalid nonce in id_token"),Promise.reject(new Error("Invalid nonce in id_token"))):this._metadataService.getIssuer().then((function(t){return i.Log.debug("ResponseValidator._validateIdToken: Received issuer"),n._getSigningKeyForJwtWithSingleRetry(o).then((function(s){if(!s)return i.Log.error("ResponseValidator._validateIdToken: No key matching kid or alg found in signing keys"),Promise.reject(new Error("No key matching kid or alg found in signing keys"));var a=e.client_id,u=n._settings.clockSkew;return i.Log.debug("ResponseValidator._validateIdToken: Validaing JWT; using clock skew (in seconds) of: ",u),n._joseUtil.validateJwt(r.id_token,s,t,a,u).then((function(){return i.Log.debug("ResponseValidator._validateIdToken: JWT validation successful"),o.payload.sub?(r.profile=o.payload,r):(i.Log.error("ResponseValidator._validateIdToken: No sub present in id_token"),Promise.reject(new Error("No sub present in id_token")))}))}))})):(i.Log.error("ResponseValidator._validateIdToken: Failed to parse id_token",o),Promise.reject(new Error("Failed to parse id_token")))},t.prototype._filterByAlg=function t(e,r){var n=null;if(r.startsWith("RS"))n="RSA";else if(r.startsWith("PS"))n="PS";else{if(!r.startsWith("ES"))return i.Log.debug("ResponseValidator._filterByAlg: alg not supported: ",r),[];n="EC"}return i.Log.debug("ResponseValidator._filterByAlg: Looking for keys that match kty: ",n),e=e.filter((function(t){return t.kty===n})),i.Log.debug("ResponseValidator._filterByAlg: Number of keys that match kty: ",n,e.length),e},t.prototype._validateAccessToken=function t(e){if(!e.profile)return i.Log.error("ResponseValidator._validateAccessToken: No profile loaded from id_token"),Promise.reject(new Error("No profile loaded from id_token"));if(!e.profile.at_hash)return i.Log.error("ResponseValidator._validateAccessToken: No at_hash in id_token"),Promise.reject(new Error("No at_hash in id_token"));if(!e.id_token)return i.Log.error("ResponseValidator._validateAccessToken: No id_token"),Promise.reject(new Error("No id_token"));var r=this._joseUtil.parseJwt(e.id_token);if(!r||!r.header)return i.Log.error("ResponseValidator._validateAccessToken: Failed to parse id_token",r),Promise.reject(new Error("Failed to parse id_token"));var n=r.header.alg;if(!n||5!==n.length)return i.Log.error("ResponseValidator._validateAccessToken: Unsupported alg:",n),Promise.reject(new Error("Unsupported alg: "+n));var o=n.substr(2,3);if(!o)return i.Log.error("ResponseValidator._validateAccessToken: Unsupported alg:",n,o),Promise.reject(new Error("Unsupported alg: "+n));if(256!==(o=parseInt(o))&&384!==o&&512!==o)return i.Log.error("ResponseValidator._validateAccessToken: Unsupported alg:",n,o),Promise.reject(new Error("Unsupported alg: "+n));var s="sha"+o,a=this._joseUtil.hashString(e.access_token,s);if(!a)return i.Log.error("ResponseValidator._validateAccessToken: access_token hash failed:",s),Promise.reject(new Error("Failed to validate at_hash"));var u=a.substr(0,a.length/2),c=this._joseUtil.hexToBase64Url(u);return c!==e.profile.at_hash?(i.Log.error("ResponseValidator._validateAccessToken: Failed to validate at_hash",c,e.profile.at_hash),Promise.reject(new Error("Failed to validate at_hash"))):(i.Log.debug("ResponseValidator._validateAccessToken: success"),Promise.resolve(e))},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.UserInfoService=void 0;var n=r(7),i=r(2),o=r(0),s=r(4);function a(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.UserInfoService=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:n.JsonService,u=arguments.length>2&&void 0!==arguments[2]?arguments[2]:i.MetadataService,c=arguments.length>3&&void 0!==arguments[3]?arguments[3]:s.JoseUtil;if(a(this,t),!e)throw o.Log.error("UserInfoService.ctor: No settings passed"),new Error("settings");this._settings=e,this._jsonService=new r(void 0,void 0,this._getClaimsFromJwt.bind(this)),this._metadataService=new u(this._settings),this._joseUtil=c}return t.prototype.getClaims=function t(e){var r=this;return e?this._metadataService.getUserInfoEndpoint().then((function(t){return o.Log.debug("UserInfoService.getClaims: received userinfo url",t),r._jsonService.getJson(t,e).then((function(t){return o.Log.debug("UserInfoService.getClaims: claims received",t),t}))})):(o.Log.error("UserInfoService.getClaims: No token passed"),Promise.reject(new Error("A token is required")))},t.prototype._getClaimsFromJwt=function t(e){var r=this;try{var n=this._joseUtil.parseJwt(e.responseText);if(!n||!n.header||!n.payload)return o.Log.error("UserInfoService._getClaimsFromJwt: Failed to parse JWT",n),Promise.reject(new Error("Failed to parse id_token"));var i=n.header.kid,s=void 0;switch(this._settings.userInfoJwtIssuer){case"OP":s=this._metadataService.getIssuer();break;case"ANY":s=Promise.resolve(n.payload.iss);break;default:s=Promise.resolve(this._settings.userInfoJwtIssuer)}return s.then((function(t){return o.Log.debug("UserInfoService._getClaimsFromJwt: Received issuer:"+t),r._metadataService.getSigningKeys().then((function(s){if(!s)return o.Log.error("UserInfoService._getClaimsFromJwt: No signing keys from metadata"),Promise.reject(new Error("No signing keys from metadata"));o.Log.debug("UserInfoService._getClaimsFromJwt: Received signing keys");var a=void 0;if(i)a=s.filter((function(t){return t.kid===i}))[0];else{if((s=r._filterByAlg(s,n.header.alg)).length>1)return o.Log.error("UserInfoService._getClaimsFromJwt: No kid found in id_token and more than one key found in metadata"),Promise.reject(new Error("No kid found in id_token and more than one key found in metadata"));a=s[0]}if(!a)return o.Log.error("UserInfoService._getClaimsFromJwt: No key matching kid or alg found in signing keys"),Promise.reject(new Error("No key matching kid or alg found in signing keys"));var u=r._settings.client_id,c=r._settings.clockSkew;return o.Log.debug("UserInfoService._getClaimsFromJwt: Validaing JWT; using clock skew (in seconds) of: ",c),r._joseUtil.validateJwt(e.responseText,a,t,u,c,void 0,!0).then((function(){return o.Log.debug("UserInfoService._getClaimsFromJwt: JWT validation successful"),n.payload}))}))}))}catch(t){return o.Log.error("UserInfoService._getClaimsFromJwt: Error parsing JWT response",t.message),void reject(t)}},t.prototype._filterByAlg=function t(e,r){var n=null;if(r.startsWith("RS"))n="RSA";else if(r.startsWith("PS"))n="PS";else{if(!r.startsWith("ES"))return o.Log.debug("UserInfoService._filterByAlg: alg not supported: ",r),[];n="EC"}return o.Log.debug("UserInfoService._filterByAlg: Looking for keys that match kty: ",n),e=e.filter((function(t){return t.kty===n})),o.Log.debug("UserInfoService._filterByAlg: Number of keys that match kty: ",n,e.length),e},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.AllowedSigningAlgs=e.b64tohex=e.hextob64u=e.crypto=e.X509=e.KeyUtil=e.jws=void 0;var n=r(27);e.jws=n.jws,e.KeyUtil=n.KEYUTIL,e.X509=n.X509,e.crypto=n.crypto,e.hextob64u=n.hextob64u,e.b64tohex=n.b64tohex,e.AllowedSigningAlgs=["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES384","ES512"]},function(t,e,r){"use strict";(function(t){Object.defineProperty(e,"__esModule",{value:!0});var r,n,i,o,s,a,u,c,h,l,f,g="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},d={userAgent:!1},p={},v=v||(r=Math,i=(n={}).lib={},o=i.Base=function(){function t(){}return{extend:function e(r){t.prototype=this;var n=new t;return r&&n.mixIn(r),n.hasOwnProperty("init")||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function t(){var e=this.extend();return e.init.apply(e,arguments),e},init:function t(){},mixIn:function t(e){for(var r in e)e.hasOwnProperty(r)&&(this[r]=e[r]);e.hasOwnProperty("toString")&&(this.toString=e.toString)},clone:function t(){return this.init.prototype.extend(this)}}}(),s=i.WordArray=o.extend({init:function t(e,r){e=this.words=e||[],this.sigBytes=null!=r?r:4*e.length},toString:function t(e){return(e||u).stringify(this)},concat:function t(e){var r=this.words,n=e.words,i=this.sigBytes,o=e.sigBytes;if(this.clamp(),i%4)for(var s=0;s<o;s++){var a=n[s>>>2]>>>24-s%4*8&255;r[i+s>>>2]|=a<<24-(i+s)%4*8}else for(s=0;s<o;s+=4)r[i+s>>>2]=n[s>>>2];return this.sigBytes+=o,this},clamp:function t(){var e=this.words,n=this.sigBytes;e[n>>>2]&=4294967295<<32-n%4*8,e.length=r.ceil(n/4)},clone:function t(){var e=o.clone.call(this);return e.words=this.words.slice(0),e},random:function t(e){for(var n=[],i=0;i<e;i+=4)n.push(4294967296*r.random()|0);return new s.init(n,e)}}),a=n.enc={},u=a.Hex={stringify:function t(e){for(var r=e.words,n=e.sigBytes,i=[],o=0;o<n;o++){var s=r[o>>>2]>>>24-o%4*8&255;i.push((s>>>4).toString(16)),i.push((15&s).toString(16))}return i.join("")},parse:function t(e){for(var r=e.length,n=[],i=0;i<r;i+=2)n[i>>>3]|=parseInt(e.substr(i,2),16)<<24-i%8*4;return new s.init(n,r/2)}},c=a.Latin1={stringify:function t(e){for(var r=e.words,n=e.sigBytes,i=[],o=0;o<n;o++){var s=r[o>>>2]>>>24-o%4*8&255;i.push(String.fromCharCode(s))}return i.join("")},parse:function t(e){for(var r=e.length,n=[],i=0;i<r;i++)n[i>>>2]|=(255&e.charCodeAt(i))<<24-i%4*8;return new s.init(n,r)}},h=a.Utf8={stringify:function t(e){try{return decodeURIComponent(escape(c.stringify(e)))}catch(t){throw new Error("Malformed UTF-8 data")}},parse:function t(e){return c.parse(unescape(encodeURIComponent(e)))}},l=i.BufferedBlockAlgorithm=o.extend({reset:function t(){this._data=new s.init,this._nDataBytes=0},_append:function t(e){"string"==typeof e&&(e=h.parse(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes},_process:function t(e){var n=this._data,i=n.words,o=n.sigBytes,a=this.blockSize,u=o/(4*a),c=(u=e?r.ceil(u):r.max((0|u)-this._minBufferSize,0))*a,h=r.min(4*c,o);if(c){for(var l=0;l<c;l+=a)this._doProcessBlock(i,l);var f=i.splice(0,c);n.sigBytes-=h}return new s.init(f,h)},clone:function t(){var e=o.clone.call(this);return e._data=this._data.clone(),e},_minBufferSize:0}),i.Hasher=l.extend({cfg:o.extend(),init:function t(e){this.cfg=this.cfg.extend(e),this.reset()},reset:function t(){l.reset.call(this),this._doReset()},update:function t(e){return this._append(e),this._process(),this},finalize:function t(e){return e&&this._append(e),this._doFinalize()},blockSize:16,_createHelper:function t(e){return function(t,r){return new e.init(r).finalize(t)}},_createHmacHelper:function t(e){return function(t,r){return new f.HMAC.init(e,r).finalize(t)}}}),f=n.algo={},n);!function(t){var e,r=(e=v).lib,n=r.Base,i=r.WordArray;(e=e.x64={}).Word=n.extend({init:function t(e,r){this.high=e,this.low=r}}),e.WordArray=n.extend({init:function t(e,r){e=this.words=e||[],this.sigBytes=null!=r?r:8*e.length},toX32:function t(){for(var e=this.words,r=e.length,n=[],o=0;o<r;o++){var s=e[o];n.push(s.high),n.push(s.low)}return i.create(n,this.sigBytes)},clone:function t(){for(var e=n.clone.call(this),r=e.words=this.words.slice(0),i=r.length,o=0;o<i;o++)r[o]=r[o].clone();return e}})}(),function(){var t=v,e=t.lib.WordArray;t.enc.Base64={stringify:function t(e){var r=e.words,n=e.sigBytes,i=this._map;e.clamp(),e=[];for(var o=0;o<n;o+=3)for(var s=(r[o>>>2]>>>24-o%4*8&255)<<16|(r[o+1>>>2]>>>24-(o+1)%4*8&255)<<8|r[o+2>>>2]>>>24-(o+2)%4*8&255,a=0;4>a&&o+.75*a<n;a++)e.push(i.charAt(s>>>6*(3-a)&63));if(r=i.charAt(64))for(;e.length%4;)e.push(r);return e.join("")},parse:function t(r){var n=r.length,i=this._map;(o=i.charAt(64))&&(-1!=(o=r.indexOf(o))&&(n=o));for(var o=[],s=0,a=0;a<n;a++)if(a%4){var u=i.indexOf(r.charAt(a-1))<<a%4*2,c=i.indexOf(r.charAt(a))>>>6-a%4*2;o[s>>>2]|=(u|c)<<24-s%4*8,s++}return e.create(o,s)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}(),function(t){for(var e=v,r=(i=e.lib).WordArray,n=i.Hasher,i=e.algo,o=[],s=[],a=function t(e){return 4294967296*(e-(0|e))|0},u=2,c=0;64>c;){var h;t:{h=u;for(var l=t.sqrt(h),f=2;f<=l;f++)if(!(h%f)){h=!1;break t}h=!0}h&&(8>c&&(o[c]=a(t.pow(u,.5))),s[c]=a(t.pow(u,1/3)),c++),u++}var g=[];i=i.SHA256=n.extend({_doReset:function t(){this._hash=new r.init(o.slice(0))},_doProcessBlock:function t(e,r){for(var n=this._hash.words,i=n[0],o=n[1],a=n[2],u=n[3],c=n[4],h=n[5],l=n[6],f=n[7],d=0;64>d;d++){if(16>d)g[d]=0|e[r+d];else{var p=g[d-15],v=g[d-2];g[d]=((p<<25|p>>>7)^(p<<14|p>>>18)^p>>>3)+g[d-7]+((v<<15|v>>>17)^(v<<13|v>>>19)^v>>>10)+g[d-16]}p=f+((c<<26|c>>>6)^(c<<21|c>>>11)^(c<<7|c>>>25))+(c&h^~c&l)+s[d]+g[d],v=((i<<30|i>>>2)^(i<<19|i>>>13)^(i<<10|i>>>22))+(i&o^i&a^o&a),f=l,l=h,h=c,c=u+p|0,u=a,a=o,o=i,i=p+v|0}n[0]=n[0]+i|0,n[1]=n[1]+o|0,n[2]=n[2]+a|0,n[3]=n[3]+u|0,n[4]=n[4]+c|0,n[5]=n[5]+h|0,n[6]=n[6]+l|0,n[7]=n[7]+f|0},_doFinalize:function e(){var r=this._data,n=r.words,i=8*this._nDataBytes,o=8*r.sigBytes;return n[o>>>5]|=128<<24-o%32,n[14+(o+64>>>9<<4)]=t.floor(i/4294967296),n[15+(o+64>>>9<<4)]=i,r.sigBytes=4*n.length,this._process(),this._hash},clone:function t(){var e=n.clone.call(this);return e._hash=this._hash.clone(),e}});e.SHA256=n._createHelper(i),e.HmacSHA256=n._createHmacHelper(i)}(Math),function(){function t(){return n.create.apply(n,arguments)}for(var e=v,r=e.lib.Hasher,n=(o=e.x64).Word,i=o.WordArray,o=e.algo,s=[t(1116352408,3609767458),t(1899447441,602891725),t(3049323471,3964484399),t(3921009573,2173295548),t(961987163,4081628472),t(1508970993,3053834265),t(2453635748,2937671579),t(2870763221,3664609560),t(3624381080,2734883394),t(310598401,1164996542),t(607225278,1323610764),t(1426881987,3590304994),t(1925078388,4068182383),t(2162078206,991336113),t(2614888103,633803317),t(3248222580,3479774868),t(3835390401,2666613458),t(4022224774,944711139),t(264347078,2341262773),t(604807628,2007800933),t(770255983,1495990901),t(1249150122,1856431235),t(1555081692,3175218132),t(1996064986,2198950837),t(2554220882,3999719339),t(2821834349,766784016),t(2952996808,2566594879),t(3210313671,3203337956),t(3336571891,1034457026),t(3584528711,2466948901),t(113926993,3758326383),t(338241895,168717936),t(666307205,1188179964),t(773529912,1546045734),t(1294757372,1522805485),t(1396182291,2643833823),t(1695183700,2343527390),t(1986661051,1014477480),t(2177026350,1206759142),t(2456956037,344077627),t(2730485921,1290863460),t(2820302411,3158454273),t(3259730800,3505952657),t(3345764771,106217008),t(3516065817,3606008344),t(3600352804,1432725776),t(4094571909,1467031594),t(275423344,851169720),t(430227734,3100823752),t(506948616,1363258195),t(659060556,3750685593),t(883997877,3785050280),t(958139571,3318307427),t(1322822218,3812723403),t(1537002063,2003034995),t(1747873779,3602036899),t(1955562222,1575990012),t(2024104815,1125592928),t(2227730452,2716904306),t(2361852424,442776044),t(2428436474,593698344),t(2756734187,3733110249),t(3204031479,2999351573),t(3329325298,3815920427),t(3391569614,3928383900),t(3515267271,566280711),t(3940187606,3454069534),t(4118630271,4000239992),t(116418474,1914138554),t(174292421,2731055270),t(289380356,3203993006),t(460393269,320620315),t(685471733,587496836),t(852142971,1086792851),t(1017036298,365543100),t(1126000580,2618297676),t(1288033470,3409855158),t(1501505948,4234509866),t(1607167915,987167468),t(1816402316,1246189591)],a=[],u=0;80>u;u++)a[u]=t();o=o.SHA512=r.extend({_doReset:function t(){this._hash=new i.init([new n.init(1779033703,4089235720),new n.init(3144134277,2227873595),new n.init(1013904242,4271175723),new n.init(2773480762,1595750129),new n.init(1359893119,2917565137),new n.init(2600822924,725511199),new n.init(528734635,4215389547),new n.init(1541459225,327033209)])},_doProcessBlock:function t(e,r){for(var n=(f=this._hash.words)[0],i=f[1],o=f[2],u=f[3],c=f[4],h=f[5],l=f[6],f=f[7],g=n.high,d=n.low,p=i.high,v=i.low,y=o.high,m=o.low,_=u.high,S=u.low,w=c.high,b=c.low,F=h.high,E=h.low,x=l.high,A=l.low,k=f.high,P=f.low,C=g,T=d,R=p,I=v,D=y,N=m,L=_,U=S,B=w,O=b,j=F,M=E,H=x,V=A,K=k,q=P,J=0;80>J;J++){var W=a[J];if(16>J)var z=W.high=0|e[r+2*J],Y=W.low=0|e[r+2*J+1];else{z=((Y=(z=a[J-15]).high)>>>1|(G=z.low)<<31)^(Y>>>8|G<<24)^Y>>>7;var G=(G>>>1|Y<<31)^(G>>>8|Y<<24)^(G>>>7|Y<<25),X=((Y=(X=a[J-2]).high)>>>19|($=X.low)<<13)^(Y<<3|$>>>29)^Y>>>6,$=($>>>19|Y<<13)^($<<3|Y>>>29)^($>>>6|Y<<26),Q=(Y=a[J-7]).high,Z=(tt=a[J-16]).high,tt=tt.low;z=(z=(z=z+Q+((Y=G+Y.low)>>>0<G>>>0?1:0))+X+((Y=Y+$)>>>0<$>>>0?1:0))+Z+((Y=Y+tt)>>>0<tt>>>0?1:0);W.high=z,W.low=Y}Q=B&j^~B&H,tt=O&M^~O&V,W=C&R^C&D^R&D;var et=T&I^T&N^I&N,rt=(G=(C>>>28|T<<4)^(C<<30|T>>>2)^(C<<25|T>>>7),X=(T>>>28|C<<4)^(T<<30|C>>>2)^(T<<25|C>>>7),($=s[J]).high),nt=$.low;Z=K+((B>>>14|O<<18)^(B>>>18|O<<14)^(B<<23|O>>>9))+(($=q+((O>>>14|B<<18)^(O>>>18|B<<14)^(O<<23|B>>>9)))>>>0<q>>>0?1:0),K=H,q=V,H=j,V=M,j=B,M=O,B=L+(Z=(Z=(Z=Z+Q+(($=$+tt)>>>0<tt>>>0?1:0))+rt+(($=$+nt)>>>0<nt>>>0?1:0))+z+(($=$+Y)>>>0<Y>>>0?1:0))+((O=U+$|0)>>>0<U>>>0?1:0)|0,L=D,U=N,D=R,N=I,R=C,I=T,C=Z+(W=G+W+((Y=X+et)>>>0<X>>>0?1:0))+((T=$+Y|0)>>>0<$>>>0?1:0)|0}d=n.low=d+T,n.high=g+C+(d>>>0<T>>>0?1:0),v=i.low=v+I,i.high=p+R+(v>>>0<I>>>0?1:0),m=o.low=m+N,o.high=y+D+(m>>>0<N>>>0?1:0),S=u.low=S+U,u.high=_+L+(S>>>0<U>>>0?1:0),b=c.low=b+O,c.high=w+B+(b>>>0<O>>>0?1:0),E=h.low=E+M,h.high=F+j+(E>>>0<M>>>0?1:0),A=l.low=A+V,l.high=x+H+(A>>>0<V>>>0?1:0),P=f.low=P+q,f.high=k+K+(P>>>0<q>>>0?1:0)},_doFinalize:function t(){var e=this._data,r=e.words,n=8*this._nDataBytes,i=8*e.sigBytes;return r[i>>>5]|=128<<24-i%32,r[30+(i+128>>>10<<5)]=Math.floor(n/4294967296),r[31+(i+128>>>10<<5)]=n,e.sigBytes=4*r.length,this._process(),this._hash.toX32()},clone:function t(){var e=r.clone.call(this);return e._hash=this._hash.clone(),e},blockSize:32}),e.SHA512=r._createHelper(o),e.HmacSHA512=r._createHmacHelper(o)}(),function(){var t=v,e=(i=t.x64).Word,r=i.WordArray,n=(i=t.algo).SHA512,i=i.SHA384=n.extend({_doReset:function t(){this._hash=new r.init([new e.init(3418070365,3238371032),new e.init(1654270250,914150663),new e.init(2438529370,812702999),new e.init(355462360,4144912697),new e.init(1731405415,4290775857),new e.init(2394180231,1750603025),new e.init(3675008525,1694076839),new e.init(1203062813,3204075428)])},_doFinalize:function t(){var e=n._doFinalize.call(this);return e.sigBytes-=16,e}});t.SHA384=n._createHelper(i),t.HmacSHA384=n._createHmacHelper(i)}();
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
var y,m="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";function _(t){var e,r,n="";for(e=0;e+3<=t.length;e+=3)r=parseInt(t.substring(e,e+3),16),n+=m.charAt(r>>6)+m.charAt(63&r);for(e+1==t.length?(r=parseInt(t.substring(e,e+1),16),n+=m.charAt(r<<2)):e+2==t.length&&(r=parseInt(t.substring(e,e+2),16),n+=m.charAt(r>>2)+m.charAt((3&r)<<4)),"=";(3&n.length)>0;)n+="=";return n}function S(t){var e,r,n,i="",o=0;for(e=0;e<t.length&&"="!=t.charAt(e);++e)(n=m.indexOf(t.charAt(e)))<0||(0==o?(i+=T(n>>2),r=3&n,o=1):1==o?(i+=T(r<<2|n>>4),r=15&n,o=2):2==o?(i+=T(r),i+=T(n>>2),r=3&n,o=3):(i+=T(r<<2|n>>4),i+=T(15&n),o=0));return 1==o&&(i+=T(r<<2)),i}function w(t){var e,r=S(t),n=new Array;for(e=0;2*e<r.length;++e)n[e]=parseInt(r.substring(2*e,2*e+2),16);return n}function b(t,e,r){null!=t&&("number"==typeof t?this.fromNumber(t,e,r):null==e&&"string"!=typeof t?this.fromString(t,256):this.fromString(t,e))}function F(){return new b(null)}"Microsoft Internet Explorer"==d.appName?(b.prototype.am=function E(t,e,r,n,i,o){for(var s=32767&e,a=e>>15;--o>=0;){var u=32767&this[t],c=this[t++]>>15,h=a*u+c*s;i=((u=s*u+((32767&h)<<15)+r[n]+(1073741823&i))>>>30)+(h>>>15)+a*c+(i>>>30),r[n++]=1073741823&u}return i},y=30):"Netscape"!=d.appName?(b.prototype.am=function x(t,e,r,n,i,o){for(;--o>=0;){var s=e*this[t++]+r[n]+i;i=Math.floor(s/67108864),r[n++]=67108863&s}return i},y=26):(b.prototype.am=function A(t,e,r,n,i,o){for(var s=16383&e,a=e>>14;--o>=0;){var u=16383&this[t],c=this[t++]>>14,h=a*u+c*s;i=((u=s*u+((16383&h)<<14)+r[n]+i)>>28)+(h>>14)+a*c,r[n++]=268435455&u}return i},y=28),b.prototype.DB=y,b.prototype.DM=(1<<y)-1,b.prototype.DV=1<<y;b.prototype.FV=Math.pow(2,52),b.prototype.F1=52-y,b.prototype.F2=2*y-52;var k,P,C=new Array;for(k="0".charCodeAt(0),P=0;P<=9;++P)C[k++]=P;for(k="a".charCodeAt(0),P=10;P<36;++P)C[k++]=P;for(k="A".charCodeAt(0),P=10;P<36;++P)C[k++]=P;function T(t){return"0123456789abcdefghijklmnopqrstuvwxyz".charAt(t)}function R(t,e){var r=C[t.charCodeAt(e)];return null==r?-1:r}function I(t){var e=F();return e.fromInt(t),e}function D(t){var e,r=1;return 0!=(e=t>>>16)&&(t=e,r+=16),0!=(e=t>>8)&&(t=e,r+=8),0!=(e=t>>4)&&(t=e,r+=4),0!=(e=t>>2)&&(t=e,r+=2),0!=(e=t>>1)&&(t=e,r+=1),r}function N(t){this.m=t}function L(t){this.m=t,this.mp=t.invDigit(),this.mpl=32767&this.mp,this.mph=this.mp>>15,this.um=(1<<t.DB-15)-1,this.mt2=2*t.t}function U(t,e){return t&e}function B(t,e){return t|e}function O(t,e){return t^e}function j(t,e){return t&~e}function M(t){if(0==t)return-1;var e=0;return 0==(65535&t)&&(t>>=16,e+=16),0==(255&t)&&(t>>=8,e+=8),0==(15&t)&&(t>>=4,e+=4),0==(3&t)&&(t>>=2,e+=2),0==(1&t)&&++e,e}function H(t){for(var e=0;0!=t;)t&=t-1,++e;return e}function V(){}function K(t){return t}function q(t){this.r2=F(),this.q3=F(),b.ONE.dlShiftTo(2*t.t,this.r2),this.mu=this.r2.divide(t),this.m=t}N.prototype.convert=function J(t){return t.s<0||t.compareTo(this.m)>=0?t.mod(this.m):t},N.prototype.revert=function W(t){return t},N.prototype.reduce=function z(t){t.divRemTo(this.m,null,t)},N.prototype.mulTo=function Y(t,e,r){t.multiplyTo(e,r),this.reduce(r)},N.prototype.sqrTo=function G(t,e){t.squareTo(e),this.reduce(e)},L.prototype.convert=function X(t){var e=F();return t.abs().dlShiftTo(this.m.t,e),e.divRemTo(this.m,null,e),t.s<0&&e.compareTo(b.ZERO)>0&&this.m.subTo(e,e),e},L.prototype.revert=function $(t){var e=F();return t.copyTo(e),this.reduce(e),e},L.prototype.reduce=function Q(t){for(;t.t<=this.mt2;)t[t.t++]=0;for(var e=0;e<this.m.t;++e){var r=32767&t[e],n=r*this.mpl+((r*this.mph+(t[e]>>15)*this.mpl&this.um)<<15)&t.DM;for(t[r=e+this.m.t]+=this.m.am(0,n,t,e,0,this.m.t);t[r]>=t.DV;)t[r]-=t.DV,t[++r]++}t.clamp(),t.drShiftTo(this.m.t,t),t.compareTo(this.m)>=0&&t.subTo(this.m,t)},L.prototype.mulTo=function Z(t,e,r){t.multiplyTo(e,r),this.reduce(r)},L.prototype.sqrTo=function tt(t,e){t.squareTo(e),this.reduce(e)},b.prototype.copyTo=function et(t){for(var e=this.t-1;e>=0;--e)t[e]=this[e];t.t=this.t,t.s=this.s},b.prototype.fromInt=function rt(t){this.t=1,this.s=t<0?-1:0,t>0?this[0]=t:t<-1?this[0]=t+this.DV:this.t=0},b.prototype.fromString=function nt(t,e){var r;if(16==e)r=4;else if(8==e)r=3;else if(256==e)r=8;else if(2==e)r=1;else if(32==e)r=5;else{if(4!=e)return void this.fromRadix(t,e);r=2}this.t=0,this.s=0;for(var n=t.length,i=!1,o=0;--n>=0;){var s=8==r?255&t[n]:R(t,n);s<0?"-"==t.charAt(n)&&(i=!0):(i=!1,0==o?this[this.t++]=s:o+r>this.DB?(this[this.t-1]|=(s&(1<<this.DB-o)-1)<<o,this[this.t++]=s>>this.DB-o):this[this.t-1]|=s<<o,(o+=r)>=this.DB&&(o-=this.DB))}8==r&&0!=(128&t[0])&&(this.s=-1,o>0&&(this[this.t-1]|=(1<<this.DB-o)-1<<o)),this.clamp(),i&&b.ZERO.subTo(this,this)},b.prototype.clamp=function it(){for(var t=this.s&this.DM;this.t>0&&this[this.t-1]==t;)--this.t},b.prototype.dlShiftTo=function ot(t,e){var r;for(r=this.t-1;r>=0;--r)e[r+t]=this[r];for(r=t-1;r>=0;--r)e[r]=0;e.t=this.t+t,e.s=this.s},b.prototype.drShiftTo=function st(t,e){for(var r=t;r<this.t;++r)e[r-t]=this[r];e.t=Math.max(this.t-t,0),e.s=this.s},b.prototype.lShiftTo=function at(t,e){var r,n=t%this.DB,i=this.DB-n,o=(1<<i)-1,s=Math.floor(t/this.DB),a=this.s<<n&this.DM;for(r=this.t-1;r>=0;--r)e[r+s+1]=this[r]>>i|a,a=(this[r]&o)<<n;for(r=s-1;r>=0;--r)e[r]=0;e[s]=a,e.t=this.t+s+1,e.s=this.s,e.clamp()},b.prototype.rShiftTo=function ut(t,e){e.s=this.s;var r=Math.floor(t/this.DB);if(r>=this.t)e.t=0;else{var n=t%this.DB,i=this.DB-n,o=(1<<n)-1;e[0]=this[r]>>n;for(var s=r+1;s<this.t;++s)e[s-r-1]|=(this[s]&o)<<i,e[s-r]=this[s]>>n;n>0&&(e[this.t-r-1]|=(this.s&o)<<i),e.t=this.t-r,e.clamp()}},b.prototype.subTo=function ct(t,e){for(var r=0,n=0,i=Math.min(t.t,this.t);r<i;)n+=this[r]-t[r],e[r++]=n&this.DM,n>>=this.DB;if(t.t<this.t){for(n-=t.s;r<this.t;)n+=this[r],e[r++]=n&this.DM,n>>=this.DB;n+=this.s}else{for(n+=this.s;r<t.t;)n-=t[r],e[r++]=n&this.DM,n>>=this.DB;n-=t.s}e.s=n<0?-1:0,n<-1?e[r++]=this.DV+n:n>0&&(e[r++]=n),e.t=r,e.clamp()},b.prototype.multiplyTo=function ht(t,e){var r=this.abs(),n=t.abs(),i=r.t;for(e.t=i+n.t;--i>=0;)e[i]=0;for(i=0;i<n.t;++i)e[i+r.t]=r.am(0,n[i],e,i,0,r.t);e.s=0,e.clamp(),this.s!=t.s&&b.ZERO.subTo(e,e)},b.prototype.squareTo=function lt(t){for(var e=this.abs(),r=t.t=2*e.t;--r>=0;)t[r]=0;for(r=0;r<e.t-1;++r){var n=e.am(r,e[r],t,2*r,0,1);(t[r+e.t]+=e.am(r+1,2*e[r],t,2*r+1,n,e.t-r-1))>=e.DV&&(t[r+e.t]-=e.DV,t[r+e.t+1]=1)}t.t>0&&(t[t.t-1]+=e.am(r,e[r],t,2*r,0,1)),t.s=0,t.clamp()},b.prototype.divRemTo=function ft(t,e,r){var n=t.abs();if(!(n.t<=0)){var i=this.abs();if(i.t<n.t)return null!=e&&e.fromInt(0),void(null!=r&&this.copyTo(r));null==r&&(r=F());var o=F(),s=this.s,a=t.s,u=this.DB-D(n[n.t-1]);u>0?(n.lShiftTo(u,o),i.lShiftTo(u,r)):(n.copyTo(o),i.copyTo(r));var c=o.t,h=o[c-1];if(0!=h){var l=h*(1<<this.F1)+(c>1?o[c-2]>>this.F2:0),f=this.FV/l,g=(1<<this.F1)/l,d=1<<this.F2,p=r.t,v=p-c,y=null==e?F():e;for(o.dlShiftTo(v,y),r.compareTo(y)>=0&&(r[r.t++]=1,r.subTo(y,r)),b.ONE.dlShiftTo(c,y),y.subTo(o,o);o.t<c;)o[o.t++]=0;for(;--v>=0;){var m=r[--p]==h?this.DM:Math.floor(r[p]*f+(r[p-1]+d)*g);if((r[p]+=o.am(0,m,r,v,0,c))<m)for(o.dlShiftTo(v,y),r.subTo(y,r);r[p]<--m;)r.subTo(y,r)}null!=e&&(r.drShiftTo(c,e),s!=a&&b.ZERO.subTo(e,e)),r.t=c,r.clamp(),u>0&&r.rShiftTo(u,r),s<0&&b.ZERO.subTo(r,r)}}},b.prototype.invDigit=function gt(){if(this.t<1)return 0;var t=this[0];if(0==(1&t))return 0;var e=3&t;return(e=(e=(e=(e=e*(2-(15&t)*e)&15)*(2-(255&t)*e)&255)*(2-((65535&t)*e&65535))&65535)*(2-t*e%this.DV)%this.DV)>0?this.DV-e:-e},b.prototype.isEven=function dt(){return 0==(this.t>0?1&this[0]:this.s)},b.prototype.exp=function pt(t,e){if(t>4294967295||t<1)return b.ONE;var r=F(),n=F(),i=e.convert(this),o=D(t)-1;for(i.copyTo(r);--o>=0;)if(e.sqrTo(r,n),(t&1<<o)>0)e.mulTo(n,i,r);else{var s=r;r=n,n=s}return e.revert(r)},b.prototype.toString=function vt(t){if(this.s<0)return"-"+this.negate().toString(t);var e;if(16==t)e=4;else if(8==t)e=3;else if(2==t)e=1;else if(32==t)e=5;else{if(4!=t)return this.toRadix(t);e=2}var r,n=(1<<e)-1,i=!1,o="",s=this.t,a=this.DB-s*this.DB%e;if(s-- >0)for(a<this.DB&&(r=this[s]>>a)>0&&(i=!0,o=T(r));s>=0;)a<e?(r=(this[s]&(1<<a)-1)<<e-a,r|=this[--s]>>(a+=this.DB-e)):(r=this[s]>>(a-=e)&n,a<=0&&(a+=this.DB,--s)),r>0&&(i=!0),i&&(o+=T(r));return i?o:"0"},b.prototype.negate=function yt(){var t=F();return b.ZERO.subTo(this,t),t},b.prototype.abs=function mt(){return this.s<0?this.negate():this},b.prototype.compareTo=function _t(t){var e=this.s-t.s;if(0!=e)return e;var r=this.t;if(0!=(e=r-t.t))return this.s<0?-e:e;for(;--r>=0;)if(0!=(e=this[r]-t[r]))return e;return 0},b.prototype.bitLength=function St(){return this.t<=0?0:this.DB*(this.t-1)+D(this[this.t-1]^this.s&this.DM)},b.prototype.mod=function wt(t){var e=F();return this.abs().divRemTo(t,null,e),this.s<0&&e.compareTo(b.ZERO)>0&&t.subTo(e,e),e},b.prototype.modPowInt=function bt(t,e){var r;return r=t<256||e.isEven()?new N(e):new L(e),this.exp(t,r)},b.ZERO=I(0),b.ONE=I(1),V.prototype.convert=K,V.prototype.revert=K,V.prototype.mulTo=function Ft(t,e,r){t.multiplyTo(e,r)},V.prototype.sqrTo=function Et(t,e){t.squareTo(e)},q.prototype.convert=function xt(t){if(t.s<0||t.t>2*this.m.t)return t.mod(this.m);if(t.compareTo(this.m)<0)return t;var e=F();return t.copyTo(e),this.reduce(e),e},q.prototype.revert=function At(t){return t},q.prototype.reduce=function kt(t){for(t.drShiftTo(this.m.t-1,this.r2),t.t>this.m.t+1&&(t.t=this.m.t+1,t.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);t.compareTo(this.r2)<0;)t.dAddOffset(1,this.m.t+1);for(t.subTo(this.r2,t);t.compareTo(this.m)>=0;)t.subTo(this.m,t)},q.prototype.mulTo=function Pt(t,e,r){t.multiplyTo(e,r),this.reduce(r)},q.prototype.sqrTo=function Ct(t,e){t.squareTo(e),this.reduce(e)};var Tt=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],Rt=(1<<26)/Tt[Tt.length-1];
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function It(){this.i=0,this.j=0,this.S=new Array}b.prototype.chunkSize=function Dt(t){return Math.floor(Math.LN2*this.DB/Math.log(t))},b.prototype.toRadix=function Nt(t){if(null==t&&(t=10),0==this.signum()||t<2||t>36)return"0";var e=this.chunkSize(t),r=Math.pow(t,e),n=I(r),i=F(),o=F(),s="";for(this.divRemTo(n,i,o);i.signum()>0;)s=(r+o.intValue()).toString(t).substr(1)+s,i.divRemTo(n,i,o);return o.intValue().toString(t)+s},b.prototype.fromRadix=function Lt(t,e){this.fromInt(0),null==e&&(e=10);for(var r=this.chunkSize(e),n=Math.pow(e,r),i=!1,o=0,s=0,a=0;a<t.length;++a){var u=R(t,a);u<0?"-"==t.charAt(a)&&0==this.signum()&&(i=!0):(s=e*s+u,++o>=r&&(this.dMultiply(n),this.dAddOffset(s,0),o=0,s=0))}o>0&&(this.dMultiply(Math.pow(e,o)),this.dAddOffset(s,0)),i&&b.ZERO.subTo(this,this)},b.prototype.fromNumber=function Ut(t,e,r){if("number"==typeof e)if(t<2)this.fromInt(1);else for(this.fromNumber(t,r),this.testBit(t-1)||this.bitwiseTo(b.ONE.shiftLeft(t-1),B,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(e);)this.dAddOffset(2,0),this.bitLength()>t&&this.subTo(b.ONE.shiftLeft(t-1),this);else{var n=new Array,i=7&t;n.length=1+(t>>3),e.nextBytes(n),i>0?n[0]&=(1<<i)-1:n[0]=0,this.fromString(n,256)}},b.prototype.bitwiseTo=function Bt(t,e,r){var n,i,o=Math.min(t.t,this.t);for(n=0;n<o;++n)r[n]=e(this[n],t[n]);if(t.t<this.t){for(i=t.s&this.DM,n=o;n<this.t;++n)r[n]=e(this[n],i);r.t=this.t}else{for(i=this.s&this.DM,n=o;n<t.t;++n)r[n]=e(i,t[n]);r.t=t.t}r.s=e(this.s,t.s),r.clamp()},b.prototype.changeBit=function Ot(t,e){var r=b.ONE.shiftLeft(t);return this.bitwiseTo(r,e,r),r},b.prototype.addTo=function jt(t,e){for(var r=0,n=0,i=Math.min(t.t,this.t);r<i;)n+=this[r]+t[r],e[r++]=n&this.DM,n>>=this.DB;if(t.t<this.t){for(n+=t.s;r<this.t;)n+=this[r],e[r++]=n&this.DM,n>>=this.DB;n+=this.s}else{for(n+=this.s;r<t.t;)n+=t[r],e[r++]=n&this.DM,n>>=this.DB;n+=t.s}e.s=n<0?-1:0,n>0?e[r++]=n:n<-1&&(e[r++]=this.DV+n),e.t=r,e.clamp()},b.prototype.dMultiply=function Mt(t){this[this.t]=this.am(0,t-1,this,0,0,this.t),++this.t,this.clamp()},b.prototype.dAddOffset=function Ht(t,e){if(0!=t){for(;this.t<=e;)this[this.t++]=0;for(this[e]+=t;this[e]>=this.DV;)this[e]-=this.DV,++e>=this.t&&(this[this.t++]=0),++this[e]}},b.prototype.multiplyLowerTo=function Vt(t,e,r){var n,i=Math.min(this.t+t.t,e);for(r.s=0,r.t=i;i>0;)r[--i]=0;for(n=r.t-this.t;i<n;++i)r[i+this.t]=this.am(0,t[i],r,i,0,this.t);for(n=Math.min(t.t,e);i<n;++i)this.am(0,t[i],r,i,0,e-i);r.clamp()},b.prototype.multiplyUpperTo=function Kt(t,e,r){--e;var n=r.t=this.t+t.t-e;for(r.s=0;--n>=0;)r[n]=0;for(n=Math.max(e-this.t,0);n<t.t;++n)r[this.t+n-e]=this.am(e-n,t[n],r,0,0,this.t+n-e);r.clamp(),r.drShiftTo(1,r)},b.prototype.modInt=function qt(t){if(t<=0)return 0;var e=this.DV%t,r=this.s<0?t-1:0;if(this.t>0)if(0==e)r=this[0]%t;else for(var n=this.t-1;n>=0;--n)r=(e*r+this[n])%t;return r},b.prototype.millerRabin=function Jt(t){var e=this.subtract(b.ONE),r=e.getLowestSetBit();if(r<=0)return!1;var n=e.shiftRight(r);(t=t+1>>1)>Tt.length&&(t=Tt.length);for(var i=F(),o=0;o<t;++o){i.fromInt(Tt[Math.floor(Math.random()*Tt.length)]);var s=i.modPow(n,this);if(0!=s.compareTo(b.ONE)&&0!=s.compareTo(e)){for(var a=1;a++<r&&0!=s.compareTo(e);)if(0==(s=s.modPowInt(2,this)).compareTo(b.ONE))return!1;if(0!=s.compareTo(e))return!1}}return!0},b.prototype.clone=
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function Wt(){var t=F();return this.copyTo(t),t},b.prototype.intValue=function zt(){if(this.s<0){if(1==this.t)return this[0]-this.DV;if(0==this.t)return-1}else{if(1==this.t)return this[0];if(0==this.t)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]},b.prototype.byteValue=function Yt(){return 0==this.t?this.s:this[0]<<24>>24},b.prototype.shortValue=function Gt(){return 0==this.t?this.s:this[0]<<16>>16},b.prototype.signum=function Xt(){return this.s<0?-1:this.t<=0||1==this.t&&this[0]<=0?0:1},b.prototype.toByteArray=function $t(){var t=this.t,e=new Array;e[0]=this.s;var r,n=this.DB-t*this.DB%8,i=0;if(t-- >0)for(n<this.DB&&(r=this[t]>>n)!=(this.s&this.DM)>>n&&(e[i++]=r|this.s<<this.DB-n);t>=0;)n<8?(r=(this[t]&(1<<n)-1)<<8-n,r|=this[--t]>>(n+=this.DB-8)):(r=this[t]>>(n-=8)&255,n<=0&&(n+=this.DB,--t)),0!=(128&r)&&(r|=-256),0==i&&(128&this.s)!=(128&r)&&++i,(i>0||r!=this.s)&&(e[i++]=r);return e},b.prototype.equals=function Qt(t){return 0==this.compareTo(t)},b.prototype.min=function Zt(t){return this.compareTo(t)<0?this:t},b.prototype.max=function te(t){return this.compareTo(t)>0?this:t},b.prototype.and=function ee(t){var e=F();return this.bitwiseTo(t,U,e),e},b.prototype.or=function re(t){var e=F();return this.bitwiseTo(t,B,e),e},b.prototype.xor=function ne(t){var e=F();return this.bitwiseTo(t,O,e),e},b.prototype.andNot=function ie(t){var e=F();return this.bitwiseTo(t,j,e),e},b.prototype.not=function oe(){for(var t=F(),e=0;e<this.t;++e)t[e]=this.DM&~this[e];return t.t=this.t,t.s=~this.s,t},b.prototype.shiftLeft=function se(t){var e=F();return t<0?this.rShiftTo(-t,e):this.lShiftTo(t,e),e},b.prototype.shiftRight=function ae(t){var e=F();return t<0?this.lShiftTo(-t,e):this.rShiftTo(t,e),e},b.prototype.getLowestSetBit=function ue(){for(var t=0;t<this.t;++t)if(0!=this[t])return t*this.DB+M(this[t]);return this.s<0?this.t*this.DB:-1},b.prototype.bitCount=function ce(){for(var t=0,e=this.s&this.DM,r=0;r<this.t;++r)t+=H(this[r]^e);return t},b.prototype.testBit=function he(t){var e=Math.floor(t/this.DB);return e>=this.t?0!=this.s:0!=(this[e]&1<<t%this.DB)},b.prototype.setBit=function le(t){return this.changeBit(t,B)},b.prototype.clearBit=function fe(t){return this.changeBit(t,j)},b.prototype.flipBit=function ge(t){return this.changeBit(t,O)},b.prototype.add=function de(t){var e=F();return this.addTo(t,e),e},b.prototype.subtract=function pe(t){var e=F();return this.subTo(t,e),e},b.prototype.multiply=function ve(t){var e=F();return this.multiplyTo(t,e),e},b.prototype.divide=function ye(t){var e=F();return this.divRemTo(t,e,null),e},b.prototype.remainder=function me(t){var e=F();return this.divRemTo(t,null,e),e},b.prototype.divideAndRemainder=function _e(t){var e=F(),r=F();return this.divRemTo(t,e,r),new Array(e,r)},b.prototype.modPow=function Se(t,e){var r,n,i=t.bitLength(),o=I(1);if(i<=0)return o;r=i<18?1:i<48?3:i<144?4:i<768?5:6,n=i<8?new N(e):e.isEven()?new q(e):new L(e);var s=new Array,a=3,u=r-1,c=(1<<r)-1;if(s[1]=n.convert(this),r>1){var h=F();for(n.sqrTo(s[1],h);a<=c;)s[a]=F(),n.mulTo(h,s[a-2],s[a]),a+=2}var l,f,g=t.t-1,d=!0,p=F();for(i=D(t[g])-1;g>=0;){for(i>=u?l=t[g]>>i-u&c:(l=(t[g]&(1<<i+1)-1)<<u-i,g>0&&(l|=t[g-1]>>this.DB+i-u)),a=r;0==(1&l);)l>>=1,--a;if((i-=a)<0&&(i+=this.DB,--g),d)s[l].copyTo(o),d=!1;else{for(;a>1;)n.sqrTo(o,p),n.sqrTo(p,o),a-=2;a>0?n.sqrTo(o,p):(f=o,o=p,p=f),n.mulTo(p,s[l],o)}for(;g>=0&&0==(t[g]&1<<i);)n.sqrTo(o,p),f=o,o=p,p=f,--i<0&&(i=this.DB-1,--g)}return n.revert(o)},b.prototype.modInverse=function we(t){var e=t.isEven();if(this.isEven()&&e||0==t.signum())return b.ZERO;for(var r=t.clone(),n=this.clone(),i=I(1),o=I(0),s=I(0),a=I(1);0!=r.signum();){for(;r.isEven();)r.rShiftTo(1,r),e?(i.isEven()&&o.isEven()||(i.addTo(this,i),o.subTo(t,o)),i.rShiftTo(1,i)):o.isEven()||o.subTo(t,o),o.rShiftTo(1,o);for(;n.isEven();)n.rShiftTo(1,n),e?(s.isEven()&&a.isEven()||(s.addTo(this,s),a.subTo(t,a)),s.rShiftTo(1,s)):a.isEven()||a.subTo(t,a),a.rShiftTo(1,a);r.compareTo(n)>=0?(r.subTo(n,r),e&&i.subTo(s,i),o.subTo(a,o)):(n.subTo(r,n),e&&s.subTo(i,s),a.subTo(o,a))}return 0!=n.compareTo(b.ONE)?b.ZERO:a.compareTo(t)>=0?a.subtract(t):a.signum()<0?(a.addTo(t,a),a.signum()<0?a.add(t):a):a},b.prototype.pow=function be(t){return this.exp(t,new V)},b.prototype.gcd=function Fe(t){var e=this.s<0?this.negate():this.clone(),r=t.s<0?t.negate():t.clone();if(e.compareTo(r)<0){var n=e;e=r,r=n}var i=e.getLowestSetBit(),o=r.getLowestSetBit();if(o<0)return e;for(i<o&&(o=i),o>0&&(e.rShiftTo(o,e),r.rShiftTo(o,r));e.signum()>0;)(i=e.getLowestSetBit())>0&&e.rShiftTo(i,e),(i=r.getLowestSetBit())>0&&r.rShiftTo(i,r),e.compareTo(r)>=0?(e.subTo(r,e),e.rShiftTo(1,e)):(r.subTo(e,r),r.rShiftTo(1,r));return o>0&&r.lShiftTo(o,r),r},b.prototype.isProbablePrime=function Ee(t){var e,r=this.abs();if(1==r.t&&r[0]<=Tt[Tt.length-1]){for(e=0;e<Tt.length;++e)if(r[0]==Tt[e])return!0;return!1}if(r.isEven())return!1;for(e=1;e<Tt.length;){for(var n=Tt[e],i=e+1;i<Tt.length&&n<Rt;)n*=Tt[i++];for(n=r.modInt(n);e<i;)if(n%Tt[e++]==0)return!1}return r.millerRabin(t)},b.prototype.square=function xe(){var t=F();return this.squareTo(t),t},It.prototype.init=function Ae(t){var e,r,n;for(e=0;e<256;++e)this.S[e]=e;for(r=0,e=0;e<256;++e)r=r+this.S[e]+t[e%t.length]&255,n=this.S[e],this.S[e]=this.S[r],this.S[r]=n;this.i=0,this.j=0},It.prototype.next=function ke(){var t;return this.i=this.i+1&255,this.j=this.j+this.S[this.i]&255,t=this.S[this.i],this.S[this.i]=this.S[this.j],this.S[this.j]=t,this.S[t+this.S[this.i]&255]};var Pe,Ce,Te;
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */function Re(){!function t(e){Ce[Te++]^=255&e,Ce[Te++]^=e>>8&255,Ce[Te++]^=e>>16&255,Ce[Te++]^=e>>24&255,Te>=256&&(Te-=256)}((new Date).getTime())}if(null==Ce){var Ie;if(Ce=new Array,Te=0,void 0!==p&&(void 0!==p.crypto||void 0!==p.msCrypto)){var De=p.crypto||p.msCrypto;if(De.getRandomValues){var Ne=new Uint8Array(32);for(De.getRandomValues(Ne),Ie=0;Ie<32;++Ie)Ce[Te++]=Ne[Ie]}else if("Netscape"==d.appName&&d.appVersion<"5"){var Le=p.crypto.random(32);for(Ie=0;Ie<Le.length;++Ie)Ce[Te++]=255&Le.charCodeAt(Ie)}}for(;Te<256;)Ie=Math.floor(65536*Math.random()),Ce[Te++]=Ie>>>8,Ce[Te++]=255&Ie;Te=0,Re()}function Ue(){if(null==Pe){for(Re(),(Pe=function t(){return new It}()).init(Ce),Te=0;Te<Ce.length;++Te)Ce[Te]=0;Te=0}return Pe.next()}function Be(){}
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function Oe(t,e){return new b(t,e)}function je(t,e,r){for(var n="",i=0;n.length<e;)n+=r(String.fromCharCode.apply(String,t.concat([(4278190080&i)>>24,(16711680&i)>>16,(65280&i)>>8,255&i]))),i+=1;return n}function Me(){this.n=null,this.e=0,this.d=null,this.p=null,this.q=null,this.dmp1=null,this.dmq1=null,this.coeff=null}
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function He(t,e){this.x=e,this.q=t}function Ve(t,e,r,n){this.curve=t,this.x=e,this.y=r,this.z=null==n?b.ONE:n,this.zinv=null}function Ke(t,e,r){this.q=t,this.a=this.fromBigInteger(e),this.b=this.fromBigInteger(r),this.infinity=new Ve(this,null,null)}Be.prototype.nextBytes=function qe(t){var e;for(e=0;e<t.length;++e)t[e]=Ue()},Me.prototype.doPublic=function Je(t){return t.modPowInt(this.e,this.n)},Me.prototype.setPublic=function We(t,e){if(this.isPublic=!0,this.isPrivate=!1,"string"!=typeof t)this.n=t,this.e=e;else{if(!(null!=t&&null!=e&&t.length>0&&e.length>0))throw"Invalid RSA public key";this.n=Oe(t,16),this.e=parseInt(e,16)}},Me.prototype.encrypt=function ze(t){var e=function r(t,e){if(e<t.length+11)throw"Message too long for RSA";for(var r=new Array,n=t.length-1;n>=0&&e>0;){var i=t.charCodeAt(n--);i<128?r[--e]=i:i>127&&i<2048?(r[--e]=63&i|128,r[--e]=i>>6|192):(r[--e]=63&i|128,r[--e]=i>>6&63|128,r[--e]=i>>12|224)}r[--e]=0;for(var o=new Be,s=new Array;e>2;){for(s[0]=0;0==s[0];)o.nextBytes(s);r[--e]=s[0]}return r[--e]=2,r[--e]=0,new b(r)}(t,this.n.bitLength()+7>>3);if(null==e)return null;var n=this.doPublic(e);if(null==n)return null;var i=n.toString(16);return 0==(1&i.length)?i:"0"+i},Me.prototype.encryptOAEP=function Ye(t,e,r){var n=function i(t,e,r,n){var i=Sr.crypto.MessageDigest,o=Sr.crypto.Util,s=null;if(r||(r="sha1"),"string"==typeof r&&(s=i.getCanonicalAlgName(r),n=i.getHashLength(s),r=function t(e){return Nr(o.hashHex(Lr(e),s))}),t.length+2*n+2>e)throw"Message too long for RSA";var a,u="";for(a=0;a<e-t.length-2*n-2;a+=1)u+="\0";var c=r("")+u+""+t,h=new Array(n);(new Be).nextBytes(h);var l=je(h,c.length,r),f=[];for(a=0;a<c.length;a+=1)f[a]=c.charCodeAt(a)^l.charCodeAt(a);var g=je(f,h.length,r),d=[0];for(a=0;a<h.length;a+=1)d[a+1]=h[a]^g.charCodeAt(a);return new b(d.concat(f))}(t,this.n.bitLength()+7>>3,e,r);if(null==n)return null;var o=this.doPublic(n);if(null==o)return null;var s=o.toString(16);return 0==(1&s.length)?s:"0"+s},Me.prototype.type="RSA",He.prototype.equals=function Ge(t){return t==this||this.q.equals(t.q)&&this.x.equals(t.x)},He.prototype.toBigInteger=function Xe(){return this.x},He.prototype.negate=function $e(){return new He(this.q,this.x.negate().mod(this.q))},He.prototype.add=function Qe(t){return new He(this.q,this.x.add(t.toBigInteger()).mod(this.q))},He.prototype.subtract=function Ze(t){return new He(this.q,this.x.subtract(t.toBigInteger()).mod(this.q))},He.prototype.multiply=function tr(t){return new He(this.q,this.x.multiply(t.toBigInteger()).mod(this.q))},He.prototype.square=function er(){return new He(this.q,this.x.square().mod(this.q))},He.prototype.divide=function rr(t){return new He(this.q,this.x.multiply(t.toBigInteger().modInverse(this.q)).mod(this.q))},Ve.prototype.getX=function nr(){return null==this.zinv&&(this.zinv=this.z.modInverse(this.curve.q)),this.curve.fromBigInteger(this.x.toBigInteger().multiply(this.zinv).mod(this.curve.q))},Ve.prototype.getY=function ir(){return null==this.zinv&&(this.zinv=this.z.modInverse(this.curve.q)),this.curve.fromBigInteger(this.y.toBigInteger().multiply(this.zinv).mod(this.curve.q))},Ve.prototype.equals=function or(t){return t==this||(this.isInfinity()?t.isInfinity():t.isInfinity()?this.isInfinity():!!t.y.toBigInteger().multiply(this.z).subtract(this.y.toBigInteger().multiply(t.z)).mod(this.curve.q).equals(b.ZERO)&&t.x.toBigInteger().multiply(this.z).subtract(this.x.toBigInteger().multiply(t.z)).mod(this.curve.q).equals(b.ZERO))},Ve.prototype.isInfinity=function sr(){return null==this.x&&null==this.y||this.z.equals(b.ZERO)&&!this.y.toBigInteger().equals(b.ZERO)},Ve.prototype.negate=function ar(){return new Ve(this.curve,this.x,this.y.negate(),this.z)},Ve.prototype.add=function ur(t){if(this.isInfinity())return t;if(t.isInfinity())return this;var e=t.y.toBigInteger().multiply(this.z).subtract(this.y.toBigInteger().multiply(t.z)).mod(this.curve.q),r=t.x.toBigInteger().multiply(this.z).subtract(this.x.toBigInteger().multiply(t.z)).mod(this.curve.q);if(b.ZERO.equals(r))return b.ZERO.equals(e)?this.twice():this.curve.getInfinity();var n=new b("3"),i=this.x.toBigInteger(),o=this.y.toBigInteger(),s=(t.x.toBigInteger(),t.y.toBigInteger(),r.square()),a=s.multiply(r),u=i.multiply(s),c=e.square().multiply(this.z),h=c.subtract(u.shiftLeft(1)).multiply(t.z).subtract(a).multiply(r).mod(this.curve.q),l=u.multiply(n).multiply(e).subtract(o.multiply(a)).subtract(c.multiply(e)).multiply(t.z).add(e.multiply(a)).mod(this.curve.q),f=a.multiply(this.z).multiply(t.z).mod(this.curve.q);return new Ve(this.curve,this.curve.fromBigInteger(h),this.curve.fromBigInteger(l),f)},Ve.prototype.twice=function cr(){if(this.isInfinity())return this;if(0==this.y.toBigInteger().signum())return this.curve.getInfinity();var t=new b("3"),e=this.x.toBigInteger(),r=this.y.toBigInteger(),n=r.multiply(this.z),i=n.multiply(r).mod(this.curve.q),o=this.curve.a.toBigInteger(),s=e.square().multiply(t);b.ZERO.equals(o)||(s=s.add(this.z.square().multiply(o)));var a=(s=s.mod(this.curve.q)).square().subtract(e.shiftLeft(3).multiply(i)).shiftLeft(1).multiply(n).mod(this.curve.q),u=s.multiply(t).multiply(e).subtract(i.shiftLeft(1)).shiftLeft(2).multiply(i).subtract(s.square().multiply(s)).mod(this.curve.q),c=n.square().multiply(n).shiftLeft(3).mod(this.curve.q);return new Ve(this.curve,this.curve.fromBigInteger(a),this.curve.fromBigInteger(u),c)},Ve.prototype.multiply=function hr(t){if(this.isInfinity())return this;if(0==t.signum())return this.curve.getInfinity();var e,r=t,n=r.multiply(new b("3")),i=this.negate(),o=this,s=this.curve.q.subtract(t),a=s.multiply(new b("3")),u=new Ve(this.curve,this.x,this.y),c=u.negate();for(e=n.bitLength()-2;e>0;--e){o=o.twice();var h=n.testBit(e);h!=r.testBit(e)&&(o=o.add(h?this:i))}for(e=a.bitLength()-2;e>0;--e){u=u.twice();var l=a.testBit(e);l!=s.testBit(e)&&(u=u.add(l?u:c))}return o},Ve.prototype.multiplyTwo=function lr(t,e,r){var n;n=t.bitLength()>r.bitLength()?t.bitLength()-1:r.bitLength()-1;for(var i=this.curve.getInfinity(),o=this.add(e);n>=0;)i=i.twice(),t.testBit(n)?i=r.testBit(n)?i.add(o):i.add(this):r.testBit(n)&&(i=i.add(e)),--n;return i},Ke.prototype.getQ=function fr(){return this.q},Ke.prototype.getA=function gr(){return this.a},Ke.prototype.getB=function dr(){return this.b},Ke.prototype.equals=function pr(t){return t==this||this.q.equals(t.q)&&this.a.equals(t.a)&&this.b.equals(t.b)},Ke.prototype.getInfinity=function vr(){return this.infinity},Ke.prototype.fromBigInteger=function yr(t){return new He(this.q,t)},Ke.prototype.decodePointHex=function mr(t){switch(parseInt(t.substr(0,2),16)){case 0:return this.infinity;case 2:case 3:return null;case 4:case 6:case 7:var e=(t.length-2)/2,r=t.substr(2,e),n=t.substr(e+2,e);return new Ve(this,this.fromBigInteger(new b(r,16)),this.fromBigInteger(new b(n,16)));default:return null}},
/*! (c) Stefan Thomas | https://github.com/bitcoinjs/bitcoinjs-lib
 */
He.prototype.getByteLength=function(){return Math.floor((this.toBigInteger().bitLength()+7)/8)},Ve.prototype.getEncoded=function(t){var e=function t(e,r){var n=e.toByteArrayUnsigned();if(r<n.length)n=n.slice(n.length-r);else for(;r>n.length;)n.unshift(0);return n},r=this.getX().toBigInteger(),n=this.getY().toBigInteger(),i=e(r,32);return t?n.isEven()?i.unshift(2):i.unshift(3):(i.unshift(4),i=i.concat(e(n,32))),i},Ve.decodeFrom=function(t,e){e[0];var r=e.length-1,n=e.slice(1,1+r/2),i=e.slice(1+r/2,1+r);n.unshift(0),i.unshift(0);var o=new b(n),s=new b(i);return new Ve(t,t.fromBigInteger(o),t.fromBigInteger(s))},Ve.decodeFromHex=function(t,e){e.substr(0,2);var r=e.length-2,n=e.substr(2,r/2),i=e.substr(2+r/2,r/2),o=new b(n,16),s=new b(i,16);return new Ve(t,t.fromBigInteger(o),t.fromBigInteger(s))},Ve.prototype.add2D=function(t){if(this.isInfinity())return t;if(t.isInfinity())return this;if(this.x.equals(t.x))return this.y.equals(t.y)?this.twice():this.curve.getInfinity();var e=t.x.subtract(this.x),r=t.y.subtract(this.y).divide(e),n=r.square().subtract(this.x).subtract(t.x),i=r.multiply(this.x.subtract(n)).subtract(this.y);return new Ve(this.curve,n,i)},Ve.prototype.twice2D=function(){if(this.isInfinity())return this;if(0==this.y.toBigInteger().signum())return this.curve.getInfinity();var t=this.curve.fromBigInteger(b.valueOf(2)),e=this.curve.fromBigInteger(b.valueOf(3)),r=this.x.square().multiply(e).add(this.curve.a).divide(this.y.multiply(t)),n=r.square().subtract(this.x.multiply(t)),i=r.multiply(this.x.subtract(n)).subtract(this.y);return new Ve(this.curve,n,i)},Ve.prototype.multiply2D=function(t){if(this.isInfinity())return this;if(0==t.signum())return this.curve.getInfinity();var e,r=t,n=r.multiply(new b("3")),i=this.negate(),o=this;for(e=n.bitLength()-2;e>0;--e){o=o.twice();var s=n.testBit(e);s!=r.testBit(e)&&(o=o.add2D(s?this:i))}return o},Ve.prototype.isOnCurve=function(){var t=this.getX().toBigInteger(),e=this.getY().toBigInteger(),r=this.curve.getA().toBigInteger(),n=this.curve.getB().toBigInteger(),i=this.curve.getQ(),o=e.multiply(e).mod(i),s=t.multiply(t).multiply(t).add(r.multiply(t)).add(n).mod(i);return o.equals(s)},Ve.prototype.toString=function(){return"("+this.getX().toBigInteger().toString()+","+this.getY().toBigInteger().toString()+")"},Ve.prototype.validate=function(){var t=this.curve.getQ();if(this.isInfinity())throw new Error("Point is at infinity.");var e=this.getX().toBigInteger(),r=this.getY().toBigInteger();if(e.compareTo(b.ONE)<0||e.compareTo(t.subtract(b.ONE))>0)throw new Error("x coordinate out of bounds");if(r.compareTo(b.ONE)<0||r.compareTo(t.subtract(b.ONE))>0)throw new Error("y coordinate out of bounds");if(!this.isOnCurve())throw new Error("Point is not on the curve.");if(this.multiply(t).isInfinity())throw new Error("Point is not a scalar multiple of G.");return!0};
/*! Mike Samuel (c) 2009 | code.google.com/p/json-sans-eval
 */
var _r=function(){var t=new RegExp('(?:false|true|null|[\\{\\}\\[\\]]|(?:-?\\b(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\\b)|(?:"(?:[^\\0-\\x08\\x0a-\\x1f"\\\\]|\\\\(?:["/\\\\bfnrt]|u[0-9A-Fa-f]{4}))*"))',"g"),e=new RegExp("\\\\(?:([^u])|u(.{4}))","g"),r={'"':'"',"/":"/","\\":"\\",b:"\b",f:"\f",n:"\n",r:"\r",t:"\t"};function n(t,e,n){return e?r[e]:String.fromCharCode(parseInt(n,16))}var i=new String(""),o=Object.hasOwnProperty;return function(r,s){var a,u,c=r.match(t),h=c[0],l=!1;"{"===h?a={}:"["===h?a=[]:(a=[],l=!0);for(var f=[a],d=1-l,p=c.length;d<p;++d){var v;switch((h=c[d]).charCodeAt(0)){default:(v=f[0])[u||v.length]=+h,u=void 0;break;case 34:if(-1!==(h=h.substring(1,h.length-1)).indexOf("\\")&&(h=h.replace(e,n)),v=f[0],!u){if(!(v instanceof Array)){u=h||i;break}u=v.length}v[u]=h,u=void 0;break;case 91:v=f[0],f.unshift(v[u||v.length]=[]),u=void 0;break;case 93:f.shift();break;case 102:(v=f[0])[u||v.length]=!1,u=void 0;break;case 110:(v=f[0])[u||v.length]=null,u=void 0;break;case 116:(v=f[0])[u||v.length]=!0,u=void 0;break;case 123:v=f[0],f.unshift(v[u||v.length]={}),u=void 0;break;case 125:f.shift()}}if(l){if(1!==f.length)throw new Error;a=a[0]}else if(f.length)throw new Error;if(s){a=function t(e,r){var n=e[r];if(n&&"object"===(void 0===n?"undefined":g(n))){var i=null;for(var a in n)if(o.call(n,a)&&n!==e){var u=t(n,a);void 0!==u?n[a]=u:(i||(i=[]),i.push(a))}if(i)for(var c=i.length;--c>=0;)delete n[i[c]]}return s.call(e,r,n)}({"":a},"")}return a}}();void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.asn1&&Sr.asn1||(Sr.asn1={}),Sr.asn1.ASN1Util=new function(){this.integerToByteHex=function(t){var e=t.toString(16);return e.length%2==1&&(e="0"+e),e},this.bigIntToMinTwosComplementsHex=function(t){var e=t.toString(16);if("-"!=e.substr(0,1))e.length%2==1?e="0"+e:e.match(/^[0-7]/)||(e="00"+e);else{var r=e.substr(1).length;r%2==1?r+=1:e.match(/^[0-7]/)||(r+=2);for(var n="",i=0;i<r;i++)n+="f";e=new b(n,16).xor(t).add(b.ONE).toString(16).replace(/^-/,"")}return e},this.getPEMStringFromHex=function(t,e){return jr(t,e)},this.newObject=function(t){var e=Sr.asn1,r=e.ASN1Object,n=e.DERBoolean,i=e.DERInteger,o=e.DERBitString,s=e.DEROctetString,a=e.DERNull,u=e.DERObjectIdentifier,c=e.DEREnumerated,h=e.DERUTF8String,l=e.DERNumericString,f=e.DERPrintableString,g=e.DERTeletexString,d=e.DERIA5String,p=e.DERUTCTime,v=e.DERGeneralizedTime,y=e.DERVisibleString,m=e.DERBMPString,_=e.DERSequence,S=e.DERSet,w=e.DERTaggedObject,b=e.ASN1Util.newObject;if(t instanceof e.ASN1Object)return t;var F=Object.keys(t);if(1!=F.length)throw new Error("key of param shall be only one.");var E=F[0];if(-1==":asn1:bool:int:bitstr:octstr:null:oid:enum:utf8str:numstr:prnstr:telstr:ia5str:utctime:gentime:visstr:bmpstr:seq:set:tag:".indexOf(":"+E+":"))throw new Error("undefined key: "+E);if("bool"==E)return new n(t[E]);if("int"==E)return new i(t[E]);if("bitstr"==E)return new o(t[E]);if("octstr"==E)return new s(t[E]);if("null"==E)return new a(t[E]);if("oid"==E)return new u(t[E]);if("enum"==E)return new c(t[E]);if("utf8str"==E)return new h(t[E]);if("numstr"==E)return new l(t[E]);if("prnstr"==E)return new f(t[E]);if("telstr"==E)return new g(t[E]);if("ia5str"==E)return new d(t[E]);if("utctime"==E)return new p(t[E]);if("gentime"==E)return new v(t[E]);if("visstr"==E)return new y(t[E]);if("bmpstr"==E)return new m(t[E]);if("asn1"==E)return new r(t[E]);if("seq"==E){for(var x=t[E],A=[],k=0;k<x.length;k++){var P=b(x[k]);A.push(P)}return new _({array:A})}if("set"==E){for(x=t[E],A=[],k=0;k<x.length;k++){P=b(x[k]);A.push(P)}return new S({array:A})}if("tag"==E){var C=t[E];if("[object Array]"===Object.prototype.toString.call(C)&&3==C.length){var T=b(C[2]);return new w({tag:C[0],explicit:C[1],obj:T})}return new w(C)}},this.jsonToASN1HEX=function(t){return this.newObject(t).getEncodedHex()}},Sr.asn1.ASN1Util.oidHexToInt=function(t){for(var e="",r=parseInt(t.substr(0,2),16),n=(e=Math.floor(r/40)+"."+r%40,""),i=2;i<t.length;i+=2){var o=("00000000"+parseInt(t.substr(i,2),16).toString(2)).slice(-8);if(n+=o.substr(1,7),"0"==o.substr(0,1))e=e+"."+new b(n,2).toString(10),n=""}return e},Sr.asn1.ASN1Util.oidIntToHex=function(t){var e=function t(e){var r=e.toString(16);return 1==r.length&&(r="0"+r),r},r=function t(r){var n="",i=new b(r,10).toString(2),o=7-i.length%7;7==o&&(o=0);for(var s="",a=0;a<o;a++)s+="0";i=s+i;for(a=0;a<i.length-1;a+=7){var u=i.substr(a,7);a!=i.length-7&&(u="1"+u),n+=e(parseInt(u,2))}return n};if(!t.match(/^[0-9.]+$/))throw"malformed oid string: "+t;var n="",i=t.split("."),o=40*parseInt(i[0])+parseInt(i[1]);n+=e(o),i.splice(0,2);for(var s=0;s<i.length;s++)n+=r(i[s]);return n},Sr.asn1.ASN1Object=function(t){this.params=null,this.getLengthHexFromValue=function(){if(void 0===this.hV||null==this.hV)throw new Error("this.hV is null or undefined");if(this.hV.length%2==1)throw new Error("value hex must be even length: n="+"".length+",v="+this.hV);var t=this.hV.length/2,e=t.toString(16);if(e.length%2==1&&(e="0"+e),t<128)return e;var r=e.length/2;if(r>15)throw"ASN.1 length too long to represent by 8x: n = "+t.toString(16);return(128+r).toString(16)+e},this.getEncodedHex=function(){return(null==this.hTLV||this.isModified)&&(this.hV=this.getFreshValueHex(),this.hL=this.getLengthHexFromValue(),this.hTLV=this.hT+this.hL+this.hV,this.isModified=!1),this.hTLV},this.getValueHex=function(){return this.getEncodedHex(),this.hV},this.getFreshValueHex=function(){return""},this.setByParam=function(t){this.params=t},null!=t&&null!=t.tlv&&(this.hTLV=t.tlv,this.isModified=!1)},Sr.asn1.DERAbstractString=function(t){Sr.asn1.DERAbstractString.superclass.constructor.call(this);this.getString=function(){return this.s},this.setString=function(t){this.hTLV=null,this.isModified=!0,this.s=t,this.hV=Ir(this.s).toLowerCase()},this.setStringHex=function(t){this.hTLV=null,this.isModified=!0,this.s=null,this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&("string"==typeof t?this.setString(t):void 0!==t.str?this.setString(t.str):void 0!==t.hex&&this.setStringHex(t.hex))},Zr(Sr.asn1.DERAbstractString,Sr.asn1.ASN1Object),Sr.asn1.DERAbstractTime=function(t){Sr.asn1.DERAbstractTime.superclass.constructor.call(this);this.localDateToUTC=function(t){var e=t.getTime()+6e4*t.getTimezoneOffset();return new Date(e)},this.formatDate=function(t,e,r){var n=this.zeroPadding,i=this.localDateToUTC(t),o=String(i.getFullYear());"utc"==e&&(o=o.substr(2,2));var s=o+n(String(i.getMonth()+1),2)+n(String(i.getDate()),2)+n(String(i.getHours()),2)+n(String(i.getMinutes()),2)+n(String(i.getSeconds()),2);if(!0===r){var a=i.getMilliseconds();if(0!=a){var u=n(String(a),3);s=s+"."+(u=u.replace(/[0]+$/,""))}}return s+"Z"},this.zeroPadding=function(t,e){return t.length>=e?t:new Array(e-t.length+1).join("0")+t},this.getString=function(){return this.s},this.setString=function(t){this.hTLV=null,this.isModified=!0,this.s=t,this.hV=kr(t)},this.setByDateValue=function(t,e,r,n,i,o){var s=new Date(Date.UTC(t,e-1,r,n,i,o,0));this.setByDate(s)},this.getFreshValueHex=function(){return this.hV}},Zr(Sr.asn1.DERAbstractTime,Sr.asn1.ASN1Object),Sr.asn1.DERAbstractStructured=function(t){Sr.asn1.DERAbstractString.superclass.constructor.call(this);this.setByASN1ObjectArray=function(t){this.hTLV=null,this.isModified=!0,this.asn1Array=t},this.appendASN1Object=function(t){this.hTLV=null,this.isModified=!0,this.asn1Array.push(t)},this.asn1Array=new Array,void 0!==t&&void 0!==t.array&&(this.asn1Array=t.array)},Zr(Sr.asn1.DERAbstractStructured,Sr.asn1.ASN1Object),Sr.asn1.DERBoolean=function(t){Sr.asn1.DERBoolean.superclass.constructor.call(this),this.hT="01",this.hTLV=0==t?"010100":"0101ff"},Zr(Sr.asn1.DERBoolean,Sr.asn1.ASN1Object),Sr.asn1.DERInteger=function(t){Sr.asn1.DERInteger.superclass.constructor.call(this),this.hT="02",this.setByBigInteger=function(t){this.hTLV=null,this.isModified=!0,this.hV=Sr.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t)},this.setByInteger=function(t){var e=new b(String(t),10);this.setByBigInteger(e)},this.setValueHex=function(t){this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&(void 0!==t.bigint?this.setByBigInteger(t.bigint):void 0!==t.int?this.setByInteger(t.int):"number"==typeof t?this.setByInteger(t):void 0!==t.hex&&this.setValueHex(t.hex))},Zr(Sr.asn1.DERInteger,Sr.asn1.ASN1Object),Sr.asn1.DERBitString=function(t){if(void 0!==t&&void 0!==t.obj){var e=Sr.asn1.ASN1Util.newObject(t.obj);t.hex="00"+e.getEncodedHex()}Sr.asn1.DERBitString.superclass.constructor.call(this),this.hT="03",this.setHexValueIncludingUnusedBits=function(t){this.hTLV=null,this.isModified=!0,this.hV=t},this.setUnusedBitsAndHexValue=function(t,e){if(t<0||7<t)throw"unused bits shall be from 0 to 7: u = "+t;var r="0"+t;this.hTLV=null,this.isModified=!0,this.hV=r+e},this.setByBinaryString=function(t){var e=8-(t=t.replace(/0+$/,"")).length%8;8==e&&(e=0);for(var r=0;r<=e;r++)t+="0";var n="";for(r=0;r<t.length-1;r+=8){var i=t.substr(r,8),o=parseInt(i,2).toString(16);1==o.length&&(o="0"+o),n+=o}this.hTLV=null,this.isModified=!0,this.hV="0"+e+n},this.setByBooleanArray=function(t){for(var e="",r=0;r<t.length;r++)1==t[r]?e+="1":e+="0";this.setByBinaryString(e)},this.newFalseArray=function(t){for(var e=new Array(t),r=0;r<t;r++)e[r]=!1;return e},this.getFreshValueHex=function(){return this.hV},void 0!==t&&("string"==typeof t&&t.toLowerCase().match(/^[0-9a-f]+$/)?this.setHexValueIncludingUnusedBits(t):void 0!==t.hex?this.setHexValueIncludingUnusedBits(t.hex):void 0!==t.bin?this.setByBinaryString(t.bin):void 0!==t.array&&this.setByBooleanArray(t.array))},Zr(Sr.asn1.DERBitString,Sr.asn1.ASN1Object),Sr.asn1.DEROctetString=function(t){if(void 0!==t&&void 0!==t.obj){var e=Sr.asn1.ASN1Util.newObject(t.obj);t.hex=e.getEncodedHex()}Sr.asn1.DEROctetString.superclass.constructor.call(this,t),this.hT="04"},Zr(Sr.asn1.DEROctetString,Sr.asn1.DERAbstractString),Sr.asn1.DERNull=function(){Sr.asn1.DERNull.superclass.constructor.call(this),this.hT="05",this.hTLV="0500"},Zr(Sr.asn1.DERNull,Sr.asn1.ASN1Object),Sr.asn1.DERObjectIdentifier=function(t){Sr.asn1.DERObjectIdentifier.superclass.constructor.call(this),this.hT="06",this.setValueHex=function(t){this.hTLV=null,this.isModified=!0,this.s=null,this.hV=t},this.setValueOidString=function(t){var e=function r(t){var e=function t(e){var r=e.toString(16);return 1==r.length&&(r="0"+r),r},r=function t(r){var n="",i=parseInt(r,10).toString(2),o=7-i.length%7;7==o&&(o=0);for(var s="",a=0;a<o;a++)s+="0";i=s+i;for(a=0;a<i.length-1;a+=7){var u=i.substr(a,7);a!=i.length-7&&(u="1"+u),n+=e(parseInt(u,2))}return n};try{if(!t.match(/^[0-9.]+$/))return null;var n="",i=t.split("."),o=40*parseInt(i[0],10)+parseInt(i[1],10);n+=e(o),i.splice(0,2);for(var s=0;s<i.length;s++)n+=r(i[s]);return n}catch(t){return null}}(t);if(null==e)throw new Error("malformed oid string: "+t);this.hTLV=null,this.isModified=!0,this.s=null,this.hV=e},this.setValueName=function(t){var e=Sr.asn1.x509.OID.name2oid(t);if(""===e)throw new Error("DERObjectIdentifier oidName undefined: "+t);this.setValueOidString(e)},this.setValueNameOrOid=function(t){t.match(/^[0-2].[0-9.]+$/)?this.setValueOidString(t):this.setValueName(t)},this.getFreshValueHex=function(){return this.hV},this.setByParam=function(t){"string"==typeof t?this.setValueNameOrOid(t):void 0!==t.oid?this.setValueNameOrOid(t.oid):void 0!==t.name?this.setValueNameOrOid(t.name):void 0!==t.hex&&this.setValueHex(t.hex)},void 0!==t&&this.setByParam(t)},Zr(Sr.asn1.DERObjectIdentifier,Sr.asn1.ASN1Object),Sr.asn1.DEREnumerated=function(t){Sr.asn1.DEREnumerated.superclass.constructor.call(this),this.hT="0a",this.setByBigInteger=function(t){this.hTLV=null,this.isModified=!0,this.hV=Sr.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t)},this.setByInteger=function(t){var e=new b(String(t),10);this.setByBigInteger(e)},this.setValueHex=function(t){this.hV=t},this.getFreshValueHex=function(){return this.hV},void 0!==t&&(void 0!==t.int?this.setByInteger(t.int):"number"==typeof t?this.setByInteger(t):void 0!==t.hex&&this.setValueHex(t.hex))},Zr(Sr.asn1.DEREnumerated,Sr.asn1.ASN1Object),Sr.asn1.DERUTF8String=function(t){Sr.asn1.DERUTF8String.superclass.constructor.call(this,t),this.hT="0c"},Zr(Sr.asn1.DERUTF8String,Sr.asn1.DERAbstractString),Sr.asn1.DERNumericString=function(t){Sr.asn1.DERNumericString.superclass.constructor.call(this,t),this.hT="12"},Zr(Sr.asn1.DERNumericString,Sr.asn1.DERAbstractString),Sr.asn1.DERPrintableString=function(t){Sr.asn1.DERPrintableString.superclass.constructor.call(this,t),this.hT="13"},Zr(Sr.asn1.DERPrintableString,Sr.asn1.DERAbstractString),Sr.asn1.DERTeletexString=function(t){Sr.asn1.DERTeletexString.superclass.constructor.call(this,t),this.hT="14"},Zr(Sr.asn1.DERTeletexString,Sr.asn1.DERAbstractString),Sr.asn1.DERIA5String=function(t){Sr.asn1.DERIA5String.superclass.constructor.call(this,t),this.hT="16"},Zr(Sr.asn1.DERIA5String,Sr.asn1.DERAbstractString),Sr.asn1.DERVisibleString=function(t){Sr.asn1.DERIA5String.superclass.constructor.call(this,t),this.hT="1a"},Zr(Sr.asn1.DERVisibleString,Sr.asn1.DERAbstractString),Sr.asn1.DERBMPString=function(t){Sr.asn1.DERBMPString.superclass.constructor.call(this,t),this.hT="1e"},Zr(Sr.asn1.DERBMPString,Sr.asn1.DERAbstractString),Sr.asn1.DERUTCTime=function(t){Sr.asn1.DERUTCTime.superclass.constructor.call(this,t),this.hT="17",this.setByDate=function(t){this.hTLV=null,this.isModified=!0,this.date=t,this.s=this.formatDate(this.date,"utc"),this.hV=kr(this.s)},this.getFreshValueHex=function(){return void 0===this.date&&void 0===this.s&&(this.date=new Date,this.s=this.formatDate(this.date,"utc"),this.hV=kr(this.s)),this.hV},void 0!==t&&(void 0!==t.str?this.setString(t.str):"string"==typeof t&&t.match(/^[0-9]{12}Z$/)?this.setString(t):void 0!==t.hex?this.setStringHex(t.hex):void 0!==t.date&&this.setByDate(t.date))},Zr(Sr.asn1.DERUTCTime,Sr.asn1.DERAbstractTime),Sr.asn1.DERGeneralizedTime=function(t){Sr.asn1.DERGeneralizedTime.superclass.constructor.call(this,t),this.hT="18",this.withMillis=!1,this.setByDate=function(t){this.hTLV=null,this.isModified=!0,this.date=t,this.s=this.formatDate(this.date,"gen",this.withMillis),this.hV=kr(this.s)},this.getFreshValueHex=function(){return void 0===this.date&&void 0===this.s&&(this.date=new Date,this.s=this.formatDate(this.date,"gen",this.withMillis),this.hV=kr(this.s)),this.hV},void 0!==t&&(void 0!==t.str?this.setString(t.str):"string"==typeof t&&t.match(/^[0-9]{14}Z$/)?this.setString(t):void 0!==t.hex?this.setStringHex(t.hex):void 0!==t.date&&this.setByDate(t.date),!0===t.millis&&(this.withMillis=!0))},Zr(Sr.asn1.DERGeneralizedTime,Sr.asn1.DERAbstractTime),Sr.asn1.DERSequence=function(t){Sr.asn1.DERSequence.superclass.constructor.call(this,t),this.hT="30",this.getFreshValueHex=function(){for(var t="",e=0;e<this.asn1Array.length;e++){t+=this.asn1Array[e].getEncodedHex()}return this.hV=t,this.hV}},Zr(Sr.asn1.DERSequence,Sr.asn1.DERAbstractStructured),Sr.asn1.DERSet=function(t){Sr.asn1.DERSet.superclass.constructor.call(this,t),this.hT="31",this.sortFlag=!0,this.getFreshValueHex=function(){for(var t=new Array,e=0;e<this.asn1Array.length;e++){var r=this.asn1Array[e];t.push(r.getEncodedHex())}return 1==this.sortFlag&&t.sort(),this.hV=t.join(""),this.hV},void 0!==t&&void 0!==t.sortflag&&0==t.sortflag&&(this.sortFlag=!1)},Zr(Sr.asn1.DERSet,Sr.asn1.DERAbstractStructured),Sr.asn1.DERTaggedObject=function(t){Sr.asn1.DERTaggedObject.superclass.constructor.call(this);var e=Sr.asn1;this.hT="a0",this.hV="",this.isExplicit=!0,this.asn1Object=null,this.setASN1Object=function(t,e,r){this.hT=e,this.isExplicit=t,this.asn1Object=r,this.isExplicit?(this.hV=this.asn1Object.getEncodedHex(),this.hTLV=null,this.isModified=!0):(this.hV=null,this.hTLV=r.getEncodedHex(),this.hTLV=this.hTLV.replace(/^../,e),this.isModified=!1)},this.getFreshValueHex=function(){return this.hV},this.setByParam=function(t){null!=t.tag&&(this.hT=t.tag),null!=t.explicit&&(this.isExplicit=t.explicit),null!=t.tage&&(this.hT=t.tage,this.isExplicit=!0),null!=t.tagi&&(this.hT=t.tagi,this.isExplicit=!1),null!=t.obj&&(t.obj instanceof e.ASN1Object?(this.asn1Object=t.obj,this.setASN1Object(this.isExplicit,this.hT,this.asn1Object)):"object"==g(t.obj)&&(this.asn1Object=e.ASN1Util.newObject(t.obj),this.setASN1Object(this.isExplicit,this.hT,this.asn1Object)))},null!=t&&this.setByParam(t)},Zr(Sr.asn1.DERTaggedObject,Sr.asn1.ASN1Object);var Sr,wr,br,Fr=new function(){};function Er(t){for(var e=new Array,r=0;r<t.length;r++)e[r]=t.charCodeAt(r);return e}function xr(t){for(var e="",r=0;r<t.length;r++)e+=String.fromCharCode(t[r]);return e}function Ar(t){for(var e="",r=0;r<t.length;r++){var n=t[r].toString(16);1==n.length&&(n="0"+n),e+=n}return e}function kr(t){return Ar(Er(t))}function Pr(t){return t=(t=(t=t.replace(/\=/g,"")).replace(/\+/g,"-")).replace(/\//g,"_")}function Cr(t){return t.length%4==2?t+="==":t.length%4==3&&(t+="="),t=(t=t.replace(/-/g,"+")).replace(/_/g,"/")}function Tr(t){return t.length%2==1&&(t="0"+t),Pr(_(t))}function Rr(t){return S(Cr(t))}function Ir(t){return Kr(Gr(t))}function Dr(t){return decodeURIComponent(qr(t))}function Nr(t){for(var e="",r=0;r<t.length-1;r+=2)e+=String.fromCharCode(parseInt(t.substr(r,2),16));return e}function Lr(t){for(var e="",r=0;r<t.length;r++)e+=("0"+t.charCodeAt(r).toString(16)).slice(-2);return e}function Ur(t){return _(t)}function Br(t){var e=Ur(t).replace(/(.{64})/g,"$1\r\n");return e=e.replace(/\r\n$/,"")}function Or(t){return S(t.replace(/[^0-9A-Za-z\/+=]*/g,""))}function jr(t,e){return"-----BEGIN "+e+"-----\r\n"+Br(t)+"\r\n-----END "+e+"-----\r\n"}function Mr(t,e){if(-1==t.indexOf("-----BEGIN "))throw"can't find PEM header: "+e;return Or(t=void 0!==e?(t=t.replace(new RegExp("^[^]*-----BEGIN "+e+"-----"),"")).replace(new RegExp("-----END "+e+"-----[^]*$"),""):(t=t.replace(/^[^]*-----BEGIN [^-]+-----/,"")).replace(/-----END [^-]+-----[^]*$/,""))}function Hr(t){var e,r,n,i,o,s,a,u,c,h,l;if(l=t.match(/^(\d{2}|\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(|\.\d+)Z$/))return u=l[1],e=parseInt(u),2===u.length&&(50<=e&&e<100?e=1900+e:0<=e&&e<50&&(e=2e3+e)),r=parseInt(l[2])-1,n=parseInt(l[3]),i=parseInt(l[4]),o=parseInt(l[5]),s=parseInt(l[6]),a=0,""!==(c=l[7])&&(h=(c.substr(1)+"00").substr(0,3),a=parseInt(h)),Date.UTC(e,r,n,i,o,s,a);throw"unsupported zulu format: "+t}function Vr(t){return~~(Hr(t)/1e3)}function Kr(t){return t.replace(/%/g,"")}function qr(t){return t.replace(/(..)/g,"%$1")}function Jr(t){var e="malformed IPv6 address";if(!t.match(/^[0-9A-Fa-f:]+$/))throw e;var r=(t=t.toLowerCase()).split(":").length-1;if(r<2)throw e;var n=":".repeat(7-r+2),i=(t=t.replace("::",n)).split(":");if(8!=i.length)throw e;for(var o=0;o<8;o++)i[o]=("0000"+i[o]).slice(-4);return i.join("")}function Wr(t){if(!t.match(/^[0-9A-Fa-f]{32}$/))throw"malformed IPv6 address octet";for(var e=(t=t.toLowerCase()).match(/.{1,4}/g),r=0;r<8;r++)e[r]=e[r].replace(/^0+/,""),""==e[r]&&(e[r]="0");var n=(t=":"+e.join(":")+":").match(/:(0:){2,}/g);if(null===n)return t.slice(1,-1);var i="";for(r=0;r<n.length;r++)n[r].length>i.length&&(i=n[r]);return(t=t.replace(i,"::")).slice(1,-1)}function zr(t){var e="malformed hex value";if(!t.match(/^([0-9A-Fa-f][0-9A-Fa-f]){1,}$/))throw e;if(8!=t.length)return 32==t.length?Wr(t):t;try{return parseInt(t.substr(0,2),16)+"."+parseInt(t.substr(2,2),16)+"."+parseInt(t.substr(4,2),16)+"."+parseInt(t.substr(6,2),16)}catch(t){throw e}}function Yr(t){return t.match(/.{4}/g).map((function e(t){var e=parseInt(t.substr(0,2),16),r=parseInt(t.substr(2),16);if(0==e&r<128)return String.fromCharCode(r);if(e<8){var n=128|63&r;return Dr((192|(7&e)<<3|(192&r)>>6).toString(16)+n.toString(16))}n=128|(15&e)<<2|(192&r)>>6;var i=128|63&r;return Dr((224|(240&e)>>4).toString(16)+n.toString(16)+i.toString(16))})).join("")}function Gr(t){for(var e=encodeURIComponent(t),r="",n=0;n<e.length;n++)"%"==e[n]?(r+=e.substr(n,3),n+=2):r=r+"%"+kr(e[n]);return r}function Xr(t){return!(t.length%2!=0||!t.match(/^[0-9a-f]+$/)&&!t.match(/^[0-9A-F]+$/))}function $r(t){return t.length%2==1?"0"+t:t.substr(0,1)>"7"?"00"+t:t}Fr.getLblen=function(t,e){if("8"!=t.substr(e+2,1))return 1;var r=parseInt(t.substr(e+3,1));return 0==r?-1:0<r&&r<10?r+1:-2},Fr.getL=function(t,e){var r=Fr.getLblen(t,e);return r<1?"":t.substr(e+2,2*r)},Fr.getVblen=function(t,e){var r;return""==(r=Fr.getL(t,e))?-1:("8"===r.substr(0,1)?new b(r.substr(2),16):new b(r,16)).intValue()},Fr.getVidx=function(t,e){var r=Fr.getLblen(t,e);return r<0?r:e+2*(r+1)},Fr.getV=function(t,e){var r=Fr.getVidx(t,e),n=Fr.getVblen(t,e);return t.substr(r,2*n)},Fr.getTLV=function(t,e){return t.substr(e,2)+Fr.getL(t,e)+Fr.getV(t,e)},Fr.getTLVblen=function(t,e){return 2+2*Fr.getLblen(t,e)+2*Fr.getVblen(t,e)},Fr.getNextSiblingIdx=function(t,e){return Fr.getVidx(t,e)+2*Fr.getVblen(t,e)},Fr.getChildIdx=function(t,e){var r,n,i,o=Fr,s=[];r=o.getVidx(t,e),n=2*o.getVblen(t,e),"03"==t.substr(e,2)&&(r+=2,n-=2),i=0;for(var a=r;i<=n;){var u=o.getTLVblen(t,a);if((i+=u)<=n&&s.push(a),a+=u,i>=n)break}return s},Fr.getNthChildIdx=function(t,e,r){return Fr.getChildIdx(t,e)[r]},Fr.getIdxbyList=function(t,e,r,n){var i,o,s=Fr;return 0==r.length?void 0!==n&&t.substr(e,2)!==n?-1:e:(i=r.shift())>=(o=s.getChildIdx(t,e)).length?-1:s.getIdxbyList(t,o[i],r,n)},Fr.getIdxbyListEx=function(t,e,r,n){var i,o,s=Fr;if(0==r.length)return void 0!==n&&t.substr(e,2)!==n?-1:e;i=r.shift(),o=s.getChildIdx(t,e);for(var a=0,u=0;u<o.length;u++){var c=t.substr(o[u],2);if("number"==typeof i&&!s.isContextTag(c)&&a==i||"string"==typeof i&&s.isContextTag(c,i))return s.getIdxbyListEx(t,o[u],r,n);s.isContextTag(c)||a++}return-1},Fr.getTLVbyList=function(t,e,r,n){var i=Fr,o=i.getIdxbyList(t,e,r,n);return-1==o||o>=t.length?null:i.getTLV(t,o)},Fr.getTLVbyListEx=function(t,e,r,n){var i=Fr,o=i.getIdxbyListEx(t,e,r,n);return-1==o?null:i.getTLV(t,o)},Fr.getVbyList=function(t,e,r,n,i){var o,s,a=Fr;return-1==(o=a.getIdxbyList(t,e,r,n))||o>=t.length?null:(s=a.getV(t,o),!0===i&&(s=s.substr(2)),s)},Fr.getVbyListEx=function(t,e,r,n,i){var o,s,a=Fr;return-1==(o=a.getIdxbyListEx(t,e,r,n))?null:(s=a.getV(t,o),"03"==t.substr(o,2)&&!1!==i&&(s=s.substr(2)),s)},Fr.getInt=function(t,e,r){null==r&&(r=-1);try{var n=t.substr(e,2);if("02"!=n&&"03"!=n)return r;var i=Fr.getV(t,e);return"02"==n?parseInt(i,16):function o(t){try{var e=t.substr(0,2);if("00"==e)return parseInt(t.substr(2),16);var r=parseInt(e,16),n=t.substr(2),i=parseInt(n,16).toString(2);return"0"==i&&(i="00000000"),i=i.slice(0,0-r),parseInt(i,2)}catch(t){return-1}}(i)}catch(t){return r}},Fr.getOID=function(t,e,r){null==r&&(r=null);try{return"06"!=t.substr(e,2)?r:function n(t){if(!Xr(t))return null;try{var e=[],r=t.substr(0,2),n=parseInt(r,16);e[0]=new String(Math.floor(n/40)),e[1]=new String(n%40);for(var i=t.substr(2),o=[],s=0;s<i.length/2;s++)o.push(parseInt(i.substr(2*s,2),16));var a=[],u="";for(s=0;s<o.length;s++)128&o[s]?u+=Qr((127&o[s]).toString(2),7):(u+=Qr((127&o[s]).toString(2),7),a.push(new String(parseInt(u,2))),u="");var c=e.join(".");return a.length>0&&(c=c+"."+a.join(".")),c}catch(t){return null}}(Fr.getV(t,e))}catch(t){return r}},Fr.getOIDName=function(t,e,r){null==r&&(r=null);try{var n=Fr.getOID(t,e,r);if(n==r)return r;var i=Sr.asn1.x509.OID.oid2name(n);return""==i?n:i}catch(t){return r}},Fr.getString=function(t,e,r){null==r&&(r=null);try{return Nr(Fr.getV(t,e))}catch(t){return r}},Fr.hextooidstr=function(t){var e=function t(e,r){return e.length>=r?e:new Array(r-e.length+1).join("0")+e},r=[],n=t.substr(0,2),i=parseInt(n,16);r[0]=new String(Math.floor(i/40)),r[1]=new String(i%40);for(var o=t.substr(2),s=[],a=0;a<o.length/2;a++)s.push(parseInt(o.substr(2*a,2),16));var u=[],c="";for(a=0;a<s.length;a++)128&s[a]?c+=e((127&s[a]).toString(2),7):(c+=e((127&s[a]).toString(2),7),u.push(new String(parseInt(c,2))),c="");var h=r.join(".");return u.length>0&&(h=h+"."+u.join(".")),h},Fr.dump=function(t,e,r,n){var i=Fr,o=i.getV,s=i.dump,a=i.getChildIdx,u=t;t instanceof Sr.asn1.ASN1Object&&(u=t.getEncodedHex());var c=function t(e,r){return e.length<=2*r?e:e.substr(0,r)+"..(total "+e.length/2+"bytes).."+e.substr(e.length-r,r)};void 0===e&&(e={ommit_long_octet:32}),void 0===r&&(r=0),void 0===n&&(n="");var h,l=e.ommit_long_octet;if("01"==(h=u.substr(r,2)))return"00"==(f=o(u,r))?n+"BOOLEAN FALSE\n":n+"BOOLEAN TRUE\n";if("02"==h)return n+"INTEGER "+c(f=o(u,r),l)+"\n";if("03"==h){var f=o(u,r);if(i.isASN1HEX(f.substr(2))){var g=n+"BITSTRING, encapsulates\n";return g+=s(f.substr(2),e,0,n+"  ")}return n+"BITSTRING "+c(f,l)+"\n"}if("04"==h){f=o(u,r);if(i.isASN1HEX(f)){g=n+"OCTETSTRING, encapsulates\n";return g+=s(f,e,0,n+"  ")}return n+"OCTETSTRING "+c(f,l)+"\n"}if("05"==h)return n+"NULL\n";if("06"==h){var d=o(u,r),p=Sr.asn1.ASN1Util.oidHexToInt(d),v=Sr.asn1.x509.OID.oid2name(p),y=p.replace(/\./g," ");return""!=v?n+"ObjectIdentifier "+v+" ("+y+")\n":n+"ObjectIdentifier ("+y+")\n"}if("0a"==h)return n+"ENUMERATED "+parseInt(o(u,r))+"\n";if("0c"==h)return n+"UTF8String '"+Dr(o(u,r))+"'\n";if("13"==h)return n+"PrintableString '"+Dr(o(u,r))+"'\n";if("14"==h)return n+"TeletexString '"+Dr(o(u,r))+"'\n";if("16"==h)return n+"IA5String '"+Dr(o(u,r))+"'\n";if("17"==h)return n+"UTCTime "+Dr(o(u,r))+"\n";if("18"==h)return n+"GeneralizedTime "+Dr(o(u,r))+"\n";if("1a"==h)return n+"VisualString '"+Dr(o(u,r))+"'\n";if("1e"==h)return n+"BMPString '"+Yr(o(u,r))+"'\n";if("30"==h){if("3000"==u.substr(r,4))return n+"SEQUENCE {}\n";g=n+"SEQUENCE\n";var m=e;if((2==(w=a(u,r)).length||3==w.length)&&"06"==u.substr(w[0],2)&&"04"==u.substr(w[w.length-1],2)){v=i.oidname(o(u,w[0]));var _=JSON.parse(JSON.stringify(e));_.x509ExtName=v,m=_}for(var S=0;S<w.length;S++)g+=s(u,m,w[S],n+"  ");return g}if("31"==h){g=n+"SET\n";var w=a(u,r);for(S=0;S<w.length;S++)g+=s(u,e,w[S],n+"  ");return g}if(0!=(128&(h=parseInt(h,16)))){var b=31&h;if(0!=(32&h)){for(g=n+"["+b+"]\n",w=a(u,r),S=0;S<w.length;S++)g+=s(u,e,w[S],n+"  ");return g}f=o(u,r);if(Fr.isASN1HEX(f)){var g=n+"["+b+"]\n";return g+=s(f,e,0,n+"  ")}return("68747470"==f.substr(0,8)||"subjectAltName"===e.x509ExtName&&2==b)&&(f=Dr(f)),g=n+"["+b+"] "+f+"\n"}return n+"UNKNOWN("+h+") "+o(u,r)+"\n"},Fr.isContextTag=function(t,e){var r,n;t=t.toLowerCase();try{r=parseInt(t,16)}catch(t){return-1}if(void 0===e)return 128==(192&r);try{return null!=e.match(/^\[[0-9]+\]$/)&&(!((n=parseInt(e.substr(1,e.length-1),10))>31)&&(128==(192&r)&&(31&r)==n))}catch(t){return!1}},Fr.isASN1HEX=function(t){var e=Fr;if(t.length%2==1)return!1;var r=e.getVblen(t,0),n=t.substr(0,2),i=e.getL(t,0);return t.length-n.length-i.length==2*r},Fr.checkStrictDER=function(t,e,r,n,i){var o=Fr;if(void 0===r){if("string"!=typeof t)throw new Error("not hex string");if(t=t.toLowerCase(),!Sr.lang.String.isHex(t))throw new Error("not hex string");r=t.length,i=(n=t.length/2)<128?1:Math.ceil(n.toString(16))+1}if(o.getL(t,e).length>2*i)throw new Error("L of TLV too long: idx="+e);var s=o.getVblen(t,e);if(s>n)throw new Error("value of L too long than hex: idx="+e);var a=o.getTLV(t,e),u=a.length-2-o.getL(t,e).length;if(u!==2*s)throw new Error("V string length and L's value not the same:"+u+"/"+2*s);if(0===e&&t.length!=a.length)throw new Error("total length and TLV length unmatch:"+t.length+"!="+a.length);var c=t.substr(e,2);if("02"===c){var h=o.getVidx(t,e);if("00"==t.substr(h,2)&&t.charCodeAt(h+2)<56)throw new Error("not least zeros for DER INTEGER")}if(32&parseInt(c,16)){for(var l=o.getVblen(t,e),f=0,g=o.getChildIdx(t,e),d=0;d<g.length;d++){f+=o.getTLV(t,g[d]).length,o.checkStrictDER(t,g[d],r,n,i)}if(2*l!=f)throw new Error("sum of children's TLV length and L unmatch: "+2*l+"!="+f)}},Fr.oidname=function(t){var e=Sr.asn1;Sr.lang.String.isHex(t)&&(t=e.ASN1Util.oidHexToInt(t));var r=e.x509.OID.oid2name(t);return""===r&&(r=t),r},void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.lang&&Sr.lang||(Sr.lang={}),Sr.lang.String=function(){},"function"==typeof t?(e.utf8tob64u=wr=function e(r){return Pr(t.from(r,"utf8").toString("base64"))},e.b64utoutf8=br=function e(r){return t.from(Cr(r),"base64").toString("utf8")}):(e.utf8tob64u=wr=function t(e){return Tr(Kr(Gr(e)))},e.b64utoutf8=br=function t(e){return decodeURIComponent(qr(Rr(e)))}),Sr.lang.String.isInteger=function(t){return!!t.match(/^[0-9]+$/)||!!t.match(/^-[0-9]+$/)},Sr.lang.String.isHex=function(t){return Xr(t)},Sr.lang.String.isBase64=function(t){return!(!(t=t.replace(/\s+/g,"")).match(/^[0-9A-Za-z+\/]+={0,3}$/)||t.length%4!=0)},Sr.lang.String.isBase64URL=function(t){return!t.match(/[+/=]/)&&(t=Cr(t),Sr.lang.String.isBase64(t))},Sr.lang.String.isIntegerArray=function(t){return!!(t=t.replace(/\s+/g,"")).match(/^\[[0-9,]+\]$/)},Sr.lang.String.isPrintable=function(t){return null!==t.match(/^[0-9A-Za-z '()+,-./:=?]*$/)},Sr.lang.String.isIA5=function(t){return null!==t.match(/^[\x20-\x21\x23-\x7f]*$/)},Sr.lang.String.isMail=function(t){return null!==t.match(/^[A-Za-z0-9]{1}[A-Za-z0-9_.-]*@{1}[A-Za-z0-9_.-]{1,}\.[A-Za-z0-9]{1,}$/)};var Qr=function t(e,r,n){return null==n&&(n="0"),e.length>=r?e:new Array(r-e.length+1).join(n)+e};function Zr(t,e){var r=function t(){};r.prototype=e.prototype,t.prototype=new r,t.prototype.constructor=t,t.superclass=e.prototype,e.prototype.constructor==Object.prototype.constructor&&(e.prototype.constructor=e)}void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.crypto&&Sr.crypto||(Sr.crypto={}),Sr.crypto.Util=new function(){this.DIGESTINFOHEAD={sha1:"3021300906052b0e03021a05000414",sha224:"302d300d06096086480165030402040500041c",sha256:"3031300d060960864801650304020105000420",sha384:"3041300d060960864801650304020205000430",sha512:"3051300d060960864801650304020305000440",md2:"3020300c06082a864886f70d020205000410",md5:"3020300c06082a864886f70d020505000410",ripemd160:"3021300906052b2403020105000414"},this.DEFAULTPROVIDER={md5:"cryptojs",sha1:"cryptojs",sha224:"cryptojs",sha256:"cryptojs",sha384:"cryptojs",sha512:"cryptojs",ripemd160:"cryptojs",hmacmd5:"cryptojs",hmacsha1:"cryptojs",hmacsha224:"cryptojs",hmacsha256:"cryptojs",hmacsha384:"cryptojs",hmacsha512:"cryptojs",hmacripemd160:"cryptojs",MD5withRSA:"cryptojs/jsrsa",SHA1withRSA:"cryptojs/jsrsa",SHA224withRSA:"cryptojs/jsrsa",SHA256withRSA:"cryptojs/jsrsa",SHA384withRSA:"cryptojs/jsrsa",SHA512withRSA:"cryptojs/jsrsa",RIPEMD160withRSA:"cryptojs/jsrsa",MD5withECDSA:"cryptojs/jsrsa",SHA1withECDSA:"cryptojs/jsrsa",SHA224withECDSA:"cryptojs/jsrsa",SHA256withECDSA:"cryptojs/jsrsa",SHA384withECDSA:"cryptojs/jsrsa",SHA512withECDSA:"cryptojs/jsrsa",RIPEMD160withECDSA:"cryptojs/jsrsa",SHA1withDSA:"cryptojs/jsrsa",SHA224withDSA:"cryptojs/jsrsa",SHA256withDSA:"cryptojs/jsrsa",MD5withRSAandMGF1:"cryptojs/jsrsa",SHAwithRSAandMGF1:"cryptojs/jsrsa",SHA1withRSAandMGF1:"cryptojs/jsrsa",SHA224withRSAandMGF1:"cryptojs/jsrsa",SHA256withRSAandMGF1:"cryptojs/jsrsa",SHA384withRSAandMGF1:"cryptojs/jsrsa",SHA512withRSAandMGF1:"cryptojs/jsrsa",RIPEMD160withRSAandMGF1:"cryptojs/jsrsa"},this.CRYPTOJSMESSAGEDIGESTNAME={md5:v.algo.MD5,sha1:v.algo.SHA1,sha224:v.algo.SHA224,sha256:v.algo.SHA256,sha384:v.algo.SHA384,sha512:v.algo.SHA512,ripemd160:v.algo.RIPEMD160},this.getDigestInfoHex=function(t,e){if(void 0===this.DIGESTINFOHEAD[e])throw"alg not supported in Util.DIGESTINFOHEAD: "+e;return this.DIGESTINFOHEAD[e]+t},this.getPaddedDigestInfoHex=function(t,e,r){var n=this.getDigestInfoHex(t,e),i=r/4;if(n.length+22>i)throw"key is too short for SigAlg: keylen="+r+","+e;for(var o="0001",s="00"+n,a="",u=i-o.length-s.length,c=0;c<u;c+=2)a+="ff";return o+a+s},this.hashString=function(t,e){return new Sr.crypto.MessageDigest({alg:e}).digestString(t)},this.hashHex=function(t,e){return new Sr.crypto.MessageDigest({alg:e}).digestHex(t)},this.sha1=function(t){return this.hashString(t,"sha1")},this.sha256=function(t){return this.hashString(t,"sha256")},this.sha256Hex=function(t){return this.hashHex(t,"sha256")},this.sha512=function(t){return this.hashString(t,"sha512")},this.sha512Hex=function(t){return this.hashHex(t,"sha512")},this.isKey=function(t){return t instanceof Me||t instanceof Sr.crypto.DSA||t instanceof Sr.crypto.ECDSA}},Sr.crypto.Util.md5=function(t){return new Sr.crypto.MessageDigest({alg:"md5",prov:"cryptojs"}).digestString(t)},Sr.crypto.Util.ripemd160=function(t){return new Sr.crypto.MessageDigest({alg:"ripemd160",prov:"cryptojs"}).digestString(t)},Sr.crypto.Util.SECURERANDOMGEN=new Be,Sr.crypto.Util.getRandomHexOfNbytes=function(t){var e=new Array(t);return Sr.crypto.Util.SECURERANDOMGEN.nextBytes(e),Ar(e)},Sr.crypto.Util.getRandomBigIntegerOfNbytes=function(t){return new b(Sr.crypto.Util.getRandomHexOfNbytes(t),16)},Sr.crypto.Util.getRandomHexOfNbits=function(t){var e=t%8,r=new Array((t-e)/8+1);return Sr.crypto.Util.SECURERANDOMGEN.nextBytes(r),r[0]=(255<<e&255^255)&r[0],Ar(r)},Sr.crypto.Util.getRandomBigIntegerOfNbits=function(t){return new b(Sr.crypto.Util.getRandomHexOfNbits(t),16)},Sr.crypto.Util.getRandomBigIntegerZeroToMax=function(t){for(var e=t.bitLength();;){var r=Sr.crypto.Util.getRandomBigIntegerOfNbits(e);if(-1!=t.compareTo(r))return r}},Sr.crypto.Util.getRandomBigIntegerMinToMax=function(t,e){var r=t.compareTo(e);if(1==r)throw"biMin is greater than biMax";if(0==r)return t;var n=e.subtract(t);return Sr.crypto.Util.getRandomBigIntegerZeroToMax(n).add(t)},Sr.crypto.MessageDigest=function(t){this.setAlgAndProvider=function(t,e){if(null!==(t=Sr.crypto.MessageDigest.getCanonicalAlgName(t))&&void 0===e&&(e=Sr.crypto.Util.DEFAULTPROVIDER[t]),-1!=":md5:sha1:sha224:sha256:sha384:sha512:ripemd160:".indexOf(t)&&"cryptojs"==e){try{this.md=Sr.crypto.Util.CRYPTOJSMESSAGEDIGESTNAME[t].create()}catch(e){throw"setAlgAndProvider hash alg set fail alg="+t+"/"+e}this.updateString=function(t){this.md.update(t)},this.updateHex=function(t){var e=v.enc.Hex.parse(t);this.md.update(e)},this.digest=function(){return this.md.finalize().toString(v.enc.Hex)},this.digestString=function(t){return this.updateString(t),this.digest()},this.digestHex=function(t){return this.updateHex(t),this.digest()}}if(-1!=":sha256:".indexOf(t)&&"sjcl"==e){try{this.md=new sjcl.hash.sha256}catch(e){throw"setAlgAndProvider hash alg set fail alg="+t+"/"+e}this.updateString=function(t){this.md.update(t)},this.updateHex=function(t){var e=sjcl.codec.hex.toBits(t);this.md.update(e)},this.digest=function(){var t=this.md.finalize();return sjcl.codec.hex.fromBits(t)},this.digestString=function(t){return this.updateString(t),this.digest()},this.digestHex=function(t){return this.updateHex(t),this.digest()}}},this.updateString=function(t){throw"updateString(str) not supported for this alg/prov: "+this.algName+"/"+this.provName},this.updateHex=function(t){throw"updateHex(hex) not supported for this alg/prov: "+this.algName+"/"+this.provName},this.digest=function(){throw"digest() not supported for this alg/prov: "+this.algName+"/"+this.provName},this.digestString=function(t){throw"digestString(str) not supported for this alg/prov: "+this.algName+"/"+this.provName},this.digestHex=function(t){throw"digestHex(hex) not supported for this alg/prov: "+this.algName+"/"+this.provName},void 0!==t&&void 0!==t.alg&&(this.algName=t.alg,void 0===t.prov&&(this.provName=Sr.crypto.Util.DEFAULTPROVIDER[this.algName]),this.setAlgAndProvider(this.algName,this.provName))},Sr.crypto.MessageDigest.getCanonicalAlgName=function(t){return"string"==typeof t&&(t=(t=t.toLowerCase()).replace(/-/,"")),t},Sr.crypto.MessageDigest.getHashLength=function(t){var e=Sr.crypto.MessageDigest,r=e.getCanonicalAlgName(t);if(void 0===e.HASHLENGTH[r])throw"not supported algorithm: "+t;return e.HASHLENGTH[r]},Sr.crypto.MessageDigest.HASHLENGTH={md5:16,sha1:20,sha224:28,sha256:32,sha384:48,sha512:64,ripemd160:20},Sr.crypto.Mac=function(t){this.setAlgAndProvider=function(t,e){if(null==(t=t.toLowerCase())&&(t="hmacsha1"),"hmac"!=(t=t.toLowerCase()).substr(0,4))throw"setAlgAndProvider unsupported HMAC alg: "+t;void 0===e&&(e=Sr.crypto.Util.DEFAULTPROVIDER[t]),this.algProv=t+"/"+e;var r=t.substr(4);if(-1!=":md5:sha1:sha224:sha256:sha384:sha512:ripemd160:".indexOf(r)&&"cryptojs"==e){try{var n=Sr.crypto.Util.CRYPTOJSMESSAGEDIGESTNAME[r];this.mac=v.algo.HMAC.create(n,this.pass)}catch(t){throw"setAlgAndProvider hash alg set fail hashAlg="+r+"/"+t}this.updateString=function(t){this.mac.update(t)},this.updateHex=function(t){var e=v.enc.Hex.parse(t);this.mac.update(e)},this.doFinal=function(){return this.mac.finalize().toString(v.enc.Hex)},this.doFinalString=function(t){return this.updateString(t),this.doFinal()},this.doFinalHex=function(t){return this.updateHex(t),this.doFinal()}}},this.updateString=function(t){throw"updateString(str) not supported for this alg/prov: "+this.algProv},this.updateHex=function(t){throw"updateHex(hex) not supported for this alg/prov: "+this.algProv},this.doFinal=function(){throw"digest() not supported for this alg/prov: "+this.algProv},this.doFinalString=function(t){throw"digestString(str) not supported for this alg/prov: "+this.algProv},this.doFinalHex=function(t){throw"digestHex(hex) not supported for this alg/prov: "+this.algProv},this.setPassword=function(t){if("string"==typeof t){var e=t;return t.length%2!=1&&t.match(/^[0-9A-Fa-f]+$/)||(e=Lr(t)),void(this.pass=v.enc.Hex.parse(e))}if("object"!=(void 0===t?"undefined":g(t)))throw"KJUR.crypto.Mac unsupported password type: "+t;e=null;if(void 0!==t.hex){if(t.hex.length%2!=0||!t.hex.match(/^[0-9A-Fa-f]+$/))throw"Mac: wrong hex password: "+t.hex;e=t.hex}if(void 0!==t.utf8&&(e=Ir(t.utf8)),void 0!==t.rstr&&(e=Lr(t.rstr)),void 0!==t.b64&&(e=S(t.b64)),void 0!==t.b64u&&(e=Rr(t.b64u)),null==e)throw"KJUR.crypto.Mac unsupported password type: "+t;this.pass=v.enc.Hex.parse(e)},void 0!==t&&(void 0!==t.pass&&this.setPassword(t.pass),void 0!==t.alg&&(this.algName=t.alg,void 0===t.prov&&(this.provName=Sr.crypto.Util.DEFAULTPROVIDER[this.algName]),this.setAlgAndProvider(this.algName,this.provName)))},Sr.crypto.Signature=function(t){var e=null;if(this._setAlgNames=function(){var t=this.algName.match(/^(.+)with(.+)$/);t&&(this.mdAlgName=t[1].toLowerCase(),this.pubkeyAlgName=t[2].toLowerCase(),"rsaandmgf1"==this.pubkeyAlgName&&"sha"==this.mdAlgName&&(this.mdAlgName="sha1"))},this._zeroPaddingOfSignature=function(t,e){for(var r="",n=e/4-t.length,i=0;i<n;i++)r+="0";return r+t},this.setAlgAndProvider=function(t,e){if(this._setAlgNames(),"cryptojs/jsrsa"!=e)throw new Error("provider not supported: "+e);if(-1!=":md5:sha1:sha224:sha256:sha384:sha512:ripemd160:".indexOf(this.mdAlgName)){try{this.md=new Sr.crypto.MessageDigest({alg:this.mdAlgName})}catch(t){throw new Error("setAlgAndProvider hash alg set fail alg="+this.mdAlgName+"/"+t)}this.init=function(t,e){var r=null;try{r=void 0===e?tn.getKey(t):tn.getKey(t,e)}catch(t){throw"init failed:"+t}if(!0===r.isPrivate)this.prvKey=r,this.state="SIGN";else{if(!0!==r.isPublic)throw"init failed.:"+r;this.pubKey=r,this.state="VERIFY"}},this.updateString=function(t){this.md.updateString(t)},this.updateHex=function(t){this.md.updateHex(t)},this.sign=function(){if(this.sHashHex=this.md.digest(),void 0===this.prvKey&&void 0!==this.ecprvhex&&void 0!==this.eccurvename&&void 0!==Sr.crypto.ECDSA&&(this.prvKey=new Sr.crypto.ECDSA({curve:this.eccurvename,prv:this.ecprvhex})),this.prvKey instanceof Me&&"rsaandmgf1"===this.pubkeyAlgName)this.hSign=this.prvKey.signWithMessageHashPSS(this.sHashHex,this.mdAlgName,this.pssSaltLen);else if(this.prvKey instanceof Me&&"rsa"===this.pubkeyAlgName)this.hSign=this.prvKey.signWithMessageHash(this.sHashHex,this.mdAlgName);else if(this.prvKey instanceof Sr.crypto.ECDSA)this.hSign=this.prvKey.signWithMessageHash(this.sHashHex);else{if(!(this.prvKey instanceof Sr.crypto.DSA))throw"Signature: unsupported private key alg: "+this.pubkeyAlgName;this.hSign=this.prvKey.signWithMessageHash(this.sHashHex)}return this.hSign},this.signString=function(t){return this.updateString(t),this.sign()},this.signHex=function(t){return this.updateHex(t),this.sign()},this.verify=function(t){if(this.sHashHex=this.md.digest(),void 0===this.pubKey&&void 0!==this.ecpubhex&&void 0!==this.eccurvename&&void 0!==Sr.crypto.ECDSA&&(this.pubKey=new Sr.crypto.ECDSA({curve:this.eccurvename,pub:this.ecpubhex})),this.pubKey instanceof Me&&"rsaandmgf1"===this.pubkeyAlgName)return this.pubKey.verifyWithMessageHashPSS(this.sHashHex,t,this.mdAlgName,this.pssSaltLen);if(this.pubKey instanceof Me&&"rsa"===this.pubkeyAlgName)return this.pubKey.verifyWithMessageHash(this.sHashHex,t);if(void 0!==Sr.crypto.ECDSA&&this.pubKey instanceof Sr.crypto.ECDSA)return this.pubKey.verifyWithMessageHash(this.sHashHex,t);if(void 0!==Sr.crypto.DSA&&this.pubKey instanceof Sr.crypto.DSA)return this.pubKey.verifyWithMessageHash(this.sHashHex,t);throw"Signature: unsupported public key alg: "+this.pubkeyAlgName}}},this.init=function(t,e){throw"init(key, pass) not supported for this alg:prov="+this.algProvName},this.updateString=function(t){throw"updateString(str) not supported for this alg:prov="+this.algProvName},this.updateHex=function(t){throw"updateHex(hex) not supported for this alg:prov="+this.algProvName},this.sign=function(){throw"sign() not supported for this alg:prov="+this.algProvName},this.signString=function(t){throw"digestString(str) not supported for this alg:prov="+this.algProvName},this.signHex=function(t){throw"digestHex(hex) not supported for this alg:prov="+this.algProvName},this.verify=function(t){throw"verify(hSigVal) not supported for this alg:prov="+this.algProvName},this.initParams=t,void 0!==t&&(void 0!==t.alg&&(this.algName=t.alg,void 0===t.prov?this.provName=Sr.crypto.Util.DEFAULTPROVIDER[this.algName]:this.provName=t.prov,this.algProvName=this.algName+":"+this.provName,this.setAlgAndProvider(this.algName,this.provName),this._setAlgNames()),void 0!==t.psssaltlen&&(this.pssSaltLen=t.psssaltlen),void 0!==t.prvkeypem)){if(void 0!==t.prvkeypas)throw"both prvkeypem and prvkeypas parameters not supported";try{e=tn.getKey(t.prvkeypem);this.init(e)}catch(t){throw"fatal error to load pem private key: "+t}}},Sr.crypto.Cipher=function(t){},Sr.crypto.Cipher.encrypt=function(t,e,r){if(e instanceof Me&&e.isPublic){var n=Sr.crypto.Cipher.getAlgByKeyAndName(e,r);if("RSA"===n)return e.encrypt(t);if("RSAOAEP"===n)return e.encryptOAEP(t,"sha1");var i=n.match(/^RSAOAEP(\d+)$/);if(null!==i)return e.encryptOAEP(t,"sha"+i[1]);throw"Cipher.encrypt: unsupported algorithm for RSAKey: "+r}throw"Cipher.encrypt: unsupported key or algorithm"},Sr.crypto.Cipher.decrypt=function(t,e,r){if(e instanceof Me&&e.isPrivate){var n=Sr.crypto.Cipher.getAlgByKeyAndName(e,r);if("RSA"===n)return e.decrypt(t);if("RSAOAEP"===n)return e.decryptOAEP(t,"sha1");var i=n.match(/^RSAOAEP(\d+)$/);if(null!==i)return e.decryptOAEP(t,"sha"+i[1]);throw"Cipher.decrypt: unsupported algorithm for RSAKey: "+r}throw"Cipher.decrypt: unsupported key or algorithm"},Sr.crypto.Cipher.getAlgByKeyAndName=function(t,e){if(t instanceof Me){if(-1!=":RSA:RSAOAEP:RSAOAEP224:RSAOAEP256:RSAOAEP384:RSAOAEP512:".indexOf(e))return e;if(null==e)return"RSA";throw"getAlgByKeyAndName: not supported algorithm name for RSAKey: "+e}throw"getAlgByKeyAndName: not supported algorithm name: "+e},Sr.crypto.OID=new function(){this.oidhex2name={"2a864886f70d010101":"rsaEncryption","2a8648ce3d0201":"ecPublicKey","2a8648ce380401":"dsa","2a8648ce3d030107":"secp256r1","2b8104001f":"secp192k1","2b81040021":"secp224r1","2b8104000a":"secp256k1","2b81040023":"secp521r1","2b81040022":"secp384r1","2a8648ce380403":"SHA1withDSA","608648016503040301":"SHA224withDSA","608648016503040302":"SHA256withDSA"}},void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.crypto&&Sr.crypto||(Sr.crypto={}),Sr.crypto.ECDSA=function(t){var e=Error,r=b,n=Ve,i=Sr.crypto.ECDSA,o=Sr.crypto.ECParameterDB,s=i.getName,a=Fr,u=a.getVbyListEx,c=a.isASN1HEX,h=new Be;this.type="EC",this.isPrivate=!1,this.isPublic=!1,this.getBigRandom=function(t){return new r(t.bitLength(),h).mod(t.subtract(r.ONE)).add(r.ONE)},this.setNamedCurve=function(t){this.ecparams=o.getByName(t),this.prvKeyHex=null,this.pubKeyHex=null,this.curveName=t},this.setPrivateKeyHex=function(t){this.isPrivate=!0,this.prvKeyHex=t},this.setPublicKeyHex=function(t){this.isPublic=!0,this.pubKeyHex=t},this.getPublicKeyXYHex=function(){var t=this.pubKeyHex;if("04"!==t.substr(0,2))throw"this method supports uncompressed format(04) only";var e=this.ecparams.keylen/4;if(t.length!==2+2*e)throw"malformed public key hex length";var r={};return r.x=t.substr(2,e),r.y=t.substr(2+e),r},this.getShortNISTPCurveName=function(){var t=this.curveName;return"secp256r1"===t||"NIST P-256"===t||"P-256"===t||"prime256v1"===t?"P-256":"secp384r1"===t||"NIST P-384"===t||"P-384"===t?"P-384":null},this.generateKeyPairHex=function(){var t=this.ecparams.n,e=this.getBigRandom(t),r=this.ecparams.G.multiply(e),n=r.getX().toBigInteger(),i=r.getY().toBigInteger(),o=this.ecparams.keylen/4,s=("0000000000"+e.toString(16)).slice(-o),a="04"+("0000000000"+n.toString(16)).slice(-o)+("0000000000"+i.toString(16)).slice(-o);return this.setPrivateKeyHex(s),this.setPublicKeyHex(a),{ecprvhex:s,ecpubhex:a}},this.signWithMessageHash=function(t){return this.signHex(t,this.prvKeyHex)},this.signHex=function(t,e){var n=new r(e,16),o=this.ecparams.n,s=new r(t.substring(0,this.ecparams.keylen/4),16);do{var a=this.getBigRandom(o),u=this.ecparams.G.multiply(a).getX().toBigInteger().mod(o)}while(u.compareTo(r.ZERO)<=0);var c=a.modInverse(o).multiply(s.add(n.multiply(u))).mod(o);return i.biRSSigToASN1Sig(u,c)},this.sign=function(t,e){var n=e,i=this.ecparams.n,o=r.fromByteArrayUnsigned(t);do{var s=this.getBigRandom(i),a=this.ecparams.G.multiply(s).getX().toBigInteger().mod(i)}while(a.compareTo(b.ZERO)<=0);var u=s.modInverse(i).multiply(o.add(n.multiply(a))).mod(i);return this.serializeSig(a,u)},this.verifyWithMessageHash=function(t,e){return this.verifyHex(t,e,this.pubKeyHex)},this.verifyHex=function(t,e,o){try{var s,a,u=i.parseSigHex(e);s=u.r,a=u.s;var c=n.decodeFromHex(this.ecparams.curve,o),h=new r(t.substring(0,this.ecparams.keylen/4),16);return this.verifyRaw(h,s,a,c)}catch(t){return!1}},this.verify=function(t,e,i){var o,s,a;if(Bitcoin.Util.isArray(e)){var u=this.parseSig(e);o=u.r,s=u.s}else{if("object"!==(void 0===e?"undefined":g(e))||!e.r||!e.s)throw"Invalid value for signature";o=e.r,s=e.s}if(i instanceof Ve)a=i;else{if(!Bitcoin.Util.isArray(i))throw"Invalid format for pubkey value, must be byte array or ECPointFp";a=n.decodeFrom(this.ecparams.curve,i)}var c=r.fromByteArrayUnsigned(t);return this.verifyRaw(c,o,s,a)},this.verifyRaw=function(t,e,n,i){var o=this.ecparams.n,s=this.ecparams.G;if(e.compareTo(r.ONE)<0||e.compareTo(o)>=0)return!1;if(n.compareTo(r.ONE)<0||n.compareTo(o)>=0)return!1;var a=n.modInverse(o),u=t.multiply(a).mod(o),c=e.multiply(a).mod(o);return s.multiply(u).add(i.multiply(c)).getX().toBigInteger().mod(o).equals(e)},this.serializeSig=function(t,e){var r=t.toByteArraySigned(),n=e.toByteArraySigned(),i=[];return i.push(2),i.push(r.length),(i=i.concat(r)).push(2),i.push(n.length),(i=i.concat(n)).unshift(i.length),i.unshift(48),i},this.parseSig=function(t){var e;if(48!=t[0])throw new Error("Signature not a valid DERSequence");if(2!=t[e=2])throw new Error("First element in signature must be a DERInteger");var n=t.slice(e+2,e+2+t[e+1]);if(2!=t[e+=2+t[e+1]])throw new Error("Second element in signature must be a DERInteger");var i=t.slice(e+2,e+2+t[e+1]);return e+=2+t[e+1],{r:r.fromByteArrayUnsigned(n),s:r.fromByteArrayUnsigned(i)}},this.parseSigCompact=function(t){if(65!==t.length)throw"Signature has the wrong length";var e=t[0]-27;if(e<0||e>7)throw"Invalid signature type";var n=this.ecparams.n;return{r:r.fromByteArrayUnsigned(t.slice(1,33)).mod(n),s:r.fromByteArrayUnsigned(t.slice(33,65)).mod(n),i:e}},this.readPKCS5PrvKeyHex=function(t){if(!1===c(t))throw new Error("not ASN.1 hex string");var e,r,n;try{e=u(t,0,["[0]",0],"06"),r=u(t,0,[1],"04");try{n=u(t,0,["[1]",0],"03")}catch(t){}}catch(t){throw new Error("malformed PKCS#1/5 plain ECC private key")}if(this.curveName=s(e),void 0===this.curveName)throw"unsupported curve name";this.setNamedCurve(this.curveName),this.setPublicKeyHex(n),this.setPrivateKeyHex(r),this.isPublic=!1},this.readPKCS8PrvKeyHex=function(t){if(!1===c(t))throw new e("not ASN.1 hex string");var r,n,i;try{u(t,0,[1,0],"06"),r=u(t,0,[1,1],"06"),n=u(t,0,[2,0,1],"04");try{i=u(t,0,[2,0,"[1]",0],"03")}catch(t){}}catch(t){throw new e("malformed PKCS#8 plain ECC private key")}if(this.curveName=s(r),void 0===this.curveName)throw new e("unsupported curve name");this.setNamedCurve(this.curveName),this.setPublicKeyHex(i),this.setPrivateKeyHex(n),this.isPublic=!1},this.readPKCS8PubKeyHex=function(t){if(!1===c(t))throw new e("not ASN.1 hex string");var r,n;try{u(t,0,[0,0],"06"),r=u(t,0,[0,1],"06"),n=u(t,0,[1],"03")}catch(t){throw new e("malformed PKCS#8 ECC public key")}if(this.curveName=s(r),null===this.curveName)throw new e("unsupported curve name");this.setNamedCurve(this.curveName),this.setPublicKeyHex(n)},this.readCertPubKeyHex=function(t,r){if(!1===c(t))throw new e("not ASN.1 hex string");var n,i;try{n=u(t,0,[0,5,0,1],"06"),i=u(t,0,[0,5,1],"03")}catch(t){throw new e("malformed X.509 certificate ECC public key")}if(this.curveName=s(n),null===this.curveName)throw new e("unsupported curve name");this.setNamedCurve(this.curveName),this.setPublicKeyHex(i)},void 0!==t&&void 0!==t.curve&&(this.curveName=t.curve),void 0===this.curveName&&(this.curveName="secp256r1"),this.setNamedCurve(this.curveName),void 0!==t&&(void 0!==t.prv&&this.setPrivateKeyHex(t.prv),void 0!==t.pub&&this.setPublicKeyHex(t.pub))},Sr.crypto.ECDSA.parseSigHex=function(t){var e=Sr.crypto.ECDSA.parseSigHexInHexRS(t);return{r:new b(e.r,16),s:new b(e.s,16)}},Sr.crypto.ECDSA.parseSigHexInHexRS=function(t){var e=Fr,r=e.getChildIdx,n=e.getV;if(e.checkStrictDER(t,0),"30"!=t.substr(0,2))throw new Error("signature is not a ASN.1 sequence");var i=r(t,0);if(2!=i.length)throw new Error("signature shall have two elements");var o=i[0],s=i[1];if("02"!=t.substr(o,2))throw new Error("1st item not ASN.1 integer");if("02"!=t.substr(s,2))throw new Error("2nd item not ASN.1 integer");return{r:n(t,o),s:n(t,s)}},Sr.crypto.ECDSA.asn1SigToConcatSig=function(t){var e=Sr.crypto.ECDSA.parseSigHexInHexRS(t),r=e.r,n=e.s;if("00"==r.substr(0,2)&&r.length%32==2&&(r=r.substr(2)),"00"==n.substr(0,2)&&n.length%32==2&&(n=n.substr(2)),r.length%32==30&&(r="00"+r),n.length%32==30&&(n="00"+n),r.length%32!=0)throw"unknown ECDSA sig r length error";if(n.length%32!=0)throw"unknown ECDSA sig s length error";return r+n},Sr.crypto.ECDSA.concatSigToASN1Sig=function(t){if(t.length/2*8%128!=0)throw"unknown ECDSA concatinated r-s sig  length error";var e=t.substr(0,t.length/2),r=t.substr(t.length/2);return Sr.crypto.ECDSA.hexRSSigToASN1Sig(e,r)},Sr.crypto.ECDSA.hexRSSigToASN1Sig=function(t,e){var r=new b(t,16),n=new b(e,16);return Sr.crypto.ECDSA.biRSSigToASN1Sig(r,n)},Sr.crypto.ECDSA.biRSSigToASN1Sig=function(t,e){var r=Sr.asn1,n=new r.DERInteger({bigint:t}),i=new r.DERInteger({bigint:e});return new r.DERSequence({array:[n,i]}).getEncodedHex()},Sr.crypto.ECDSA.getName=function(t){return"2b8104001f"===t?"secp192k1":"2a8648ce3d030107"===t?"secp256r1":"2b8104000a"===t?"secp256k1":"2b81040021"===t?"secp224r1":"2b81040022"===t?"secp384r1":-1!=="|secp256r1|NIST P-256|P-256|prime256v1|".indexOf(t)?"secp256r1":-1!=="|secp256k1|".indexOf(t)?"secp256k1":-1!=="|secp224r1|NIST P-224|P-224|".indexOf(t)?"secp224r1":-1!=="|secp384r1|NIST P-384|P-384|".indexOf(t)?"secp384r1":null},void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.crypto&&Sr.crypto||(Sr.crypto={}),Sr.crypto.ECParameterDB=new function(){var t={},e={};function r(t){return new b(t,16)}this.getByName=function(r){var n=r;if(void 0!==e[n]&&(n=e[r]),void 0!==t[n])return t[n];throw"unregistered EC curve name: "+n},this.regist=function(n,i,o,s,a,u,c,h,l,f,g,d){t[n]={};var p=r(o),v=r(s),y=r(a),m=r(u),_=r(c),S=new Ke(p,v,y),w=S.decodePointHex("04"+h+l);t[n].name=n,t[n].keylen=i,t[n].curve=S,t[n].G=w,t[n].n=m,t[n].h=_,t[n].oid=g,t[n].info=d;for(var b=0;b<f.length;b++)e[f[b]]=n}},Sr.crypto.ECParameterDB.regist("secp128r1",128,"FFFFFFFDFFFFFFFFFFFFFFFFFFFFFFFF","FFFFFFFDFFFFFFFFFFFFFFFFFFFFFFFC","E87579C11079F43DD824993C2CEE5ED3","FFFFFFFE0000000075A30D1B9038A115","1","161FF7528B899B2D0C28607CA52C5B86","CF5AC8395BAFEB13C02DA292DDED7A83",[],"","secp128r1 : SECG curve over a 128 bit prime field"),Sr.crypto.ECParameterDB.regist("secp160k1",160,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFAC73","0","7","0100000000000000000001B8FA16DFAB9ACA16B6B3","1","3B4C382CE37AA192A4019E763036F4F5DD4D7EBB","938CF935318FDCED6BC28286531733C3F03C4FEE",[],"","secp160k1 : SECG curve over a 160 bit prime field"),Sr.crypto.ECParameterDB.regist("secp160r1",160,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7FFFFFFF","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7FFFFFFC","1C97BEFC54BD7A8B65ACF89F81D4D4ADC565FA45","0100000000000000000001F4C8F927AED3CA752257","1","4A96B5688EF573284664698968C38BB913CBFC82","23A628553168947D59DCC912042351377AC5FB32",[],"","secp160r1 : SECG curve over a 160 bit prime field"),Sr.crypto.ECParameterDB.regist("secp192k1",192,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFEE37","0","3","FFFFFFFFFFFFFFFFFFFFFFFE26F2FC170F69466A74DEFD8D","1","DB4FF10EC057E9AE26B07D0280B7F4341DA5D1B1EAE06C7D","9B2F2F6D9C5628A7844163D015BE86344082AA88D95E2F9D",[]),Sr.crypto.ECParameterDB.regist("secp192r1",192,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFFF","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFFC","64210519E59C80E70FA7E9AB72243049FEB8DEECC146B9B1","FFFFFFFFFFFFFFFFFFFFFFFF99DEF836146BC9B1B4D22831","1","188DA80EB03090F67CBF20EB43A18800F4FF0AFD82FF1012","07192B95FFC8DA78631011ED6B24CDD573F977A11E794811",[]),Sr.crypto.ECParameterDB.regist("secp224r1",224,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000000000000000001","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFE","B4050A850C04B3ABF54132565044B0B7D7BFD8BA270B39432355FFB4","FFFFFFFFFFFFFFFFFFFFFFFFFFFF16A2E0B8F03E13DD29455C5C2A3D","1","B70E0CBD6BB4BF7F321390B94A03C1D356C21122343280D6115C1D21","BD376388B5F723FB4C22DFE6CD4375A05A07476444D5819985007E34",[]),Sr.crypto.ECParameterDB.regist("secp256k1",256,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F","0","7","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141","1","79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798","483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",[]),Sr.crypto.ECParameterDB.regist("secp256r1",256,"FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF","FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC","5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B","FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551","1","6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296","4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5",["NIST P-256","P-256","prime256v1"]),Sr.crypto.ECParameterDB.regist("secp384r1",384,"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFF","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFF0000000000000000FFFFFFFC","B3312FA7E23EE7E4988E056BE3F82D19181D9C6EFE8141120314088F5013875AC656398D8A2ED19D2A85C8EDD3EC2AEF","FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC7634D81F4372DDF581A0DB248B0A77AECEC196ACCC52973","1","AA87CA22BE8B05378EB1C71EF320AD746E1D3B628BA79B9859F741E082542A385502F25DBF55296C3A545E3872760AB7","3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f",["NIST P-384","P-384"]),Sr.crypto.ECParameterDB.regist("secp521r1",521,"1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF","1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC","051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00","1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409","1","C6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66","011839296a789a3bc0045c8a5fb42c7d1bd998f54449579b446817afbd17273e662c97ee72995ef42640c550b9013fad0761353c7086a272c24088be94769fd16650",["NIST P-521","P-521"]);var tn=function(){var t=function t(r,n,i){return e(v.AES,r,n,i)},e=function t(e,r,n,i){var o=v.enc.Hex.parse(r),s=v.enc.Hex.parse(n),a=v.enc.Hex.parse(i),u={};u.key=s,u.iv=a,u.ciphertext=o;var c=e.decrypt(u,s,{iv:a});return v.enc.Hex.stringify(c)},r=function t(e,r,i){return n(v.AES,e,r,i)},n=function t(e,r,n,i){var o=v.enc.Hex.parse(r),s=v.enc.Hex.parse(n),a=v.enc.Hex.parse(i),u=e.encrypt(o,s,{iv:a}),c=v.enc.Hex.parse(u.toString());return v.enc.Base64.stringify(c)},i={"AES-256-CBC":{proc:t,eproc:r,keylen:32,ivlen:16},"AES-192-CBC":{proc:t,eproc:r,keylen:24,ivlen:16},"AES-128-CBC":{proc:t,eproc:r,keylen:16,ivlen:16},"DES-EDE3-CBC":{proc:function t(r,n,i){return e(v.TripleDES,r,n,i)},eproc:function t(e,r,i){return n(v.TripleDES,e,r,i)},keylen:24,ivlen:8},"DES-CBC":{proc:function t(r,n,i){return e(v.DES,r,n,i)},eproc:function t(e,r,i){return n(v.DES,e,r,i)},keylen:8,ivlen:8}},o=function t(e){var r={},n=e.match(new RegExp("DEK-Info: ([^,]+),([0-9A-Fa-f]+)","m"));n&&(r.cipher=n[1],r.ivsalt=n[2]);var i=e.match(new RegExp("-----BEGIN ([A-Z]+) PRIVATE KEY-----"));i&&(r.type=i[1]);var o=-1,s=0;-1!=e.indexOf("\r\n\r\n")&&(o=e.indexOf("\r\n\r\n"),s=2),-1!=e.indexOf("\n\n")&&(o=e.indexOf("\n\n"),s=1);var a=e.indexOf("-----END");if(-1!=o&&-1!=a){var u=e.substring(o+2*s,a-s);u=u.replace(/\s+/g,""),r.data=u}return r},s=function t(e,r,n){for(var o=n.substring(0,16),s=v.enc.Hex.parse(o),a=v.enc.Utf8.parse(r),u=i[e].keylen+i[e].ivlen,c="",h=null;;){var l=v.algo.MD5.create();if(null!=h&&l.update(h),l.update(a),l.update(s),h=l.finalize(),(c+=v.enc.Hex.stringify(h)).length>=2*u)break}var f={};return f.keyhex=c.substr(0,2*i[e].keylen),f.ivhex=c.substr(2*i[e].keylen,2*i[e].ivlen),f},a=function t(e,r,n,o){var s=v.enc.Base64.parse(e),a=v.enc.Hex.stringify(s);return(0,i[r].proc)(a,n,o)};return{version:"1.0.0",parsePKCS5PEM:function t(e){return o(e)},getKeyAndUnusedIvByPasscodeAndIvsalt:function t(e,r,n){return s(e,r,n)},decryptKeyB64:function t(e,r,n,i){return a(e,r,n,i)},getDecryptedKeyHex:function t(e,r){var n=o(e),i=(n.type,n.cipher),u=n.ivsalt,c=n.data,h=s(i,r,u).keyhex;return a(c,i,h,u)},getEncryptedPKCS5PEMFromPrvKeyHex:function t(e,r,n,o,a){var u="";if(void 0!==o&&null!=o||(o="AES-256-CBC"),void 0===i[o])throw new Error("KEYUTIL unsupported algorithm: "+o);void 0!==a&&null!=a||(a=function t(e){var r=v.lib.WordArray.random(e);return v.enc.Hex.stringify(r)}(i[o].ivlen).toUpperCase());var c=function t(e,r,n,o){return(0,i[r].eproc)(e,n,o)}(r,o,s(o,n,a).keyhex,a);u="-----BEGIN "+e+" PRIVATE KEY-----\r\n";return u+="Proc-Type: 4,ENCRYPTED\r\n",u+="DEK-Info: "+o+","+a+"\r\n",u+="\r\n",u+=c.replace(/(.{64})/g,"$1\r\n"),u+="\r\n-----END "+e+" PRIVATE KEY-----\r\n"},parseHexOfEncryptedPKCS8:function t(e){var r=Fr,n=r.getChildIdx,i=r.getV,o={},s=n(e,0);if(2!=s.length)throw new Error("malformed format: SEQUENCE(0).items != 2: "+s.length);o.ciphertext=i(e,s[1]);var a=n(e,s[0]);if(2!=a.length)throw new Error("malformed format: SEQUENCE(0.0).items != 2: "+a.length);if("2a864886f70d01050d"!=i(e,a[0]))throw new Error("this only supports pkcs5PBES2");var u=n(e,a[1]);if(2!=a.length)throw new Error("malformed format: SEQUENCE(0.0.1).items != 2: "+u.length);var c=n(e,u[1]);if(2!=c.length)throw new Error("malformed format: SEQUENCE(0.0.1.1).items != 2: "+c.length);if("2a864886f70d0307"!=i(e,c[0]))throw"this only supports TripleDES";o.encryptionSchemeAlg="TripleDES",o.encryptionSchemeIV=i(e,c[1]);var h=n(e,u[0]);if(2!=h.length)throw new Error("malformed format: SEQUENCE(0.0.1.0).items != 2: "+h.length);if("2a864886f70d01050c"!=i(e,h[0]))throw new Error("this only supports pkcs5PBKDF2");var l=n(e,h[1]);if(l.length<2)throw new Error("malformed format: SEQUENCE(0.0.1.0.1).items < 2: "+l.length);o.pbkdf2Salt=i(e,l[0]);var f=i(e,l[1]);try{o.pbkdf2Iter=parseInt(f,16)}catch(t){throw new Error("malformed format pbkdf2Iter: "+f)}return o},getPBKDF2KeyHexFromParam:function t(e,r){var n=v.enc.Hex.parse(e.pbkdf2Salt),i=e.pbkdf2Iter,o=v.PBKDF2(r,n,{keySize:6,iterations:i});return v.enc.Hex.stringify(o)},_getPlainPKCS8HexFromEncryptedPKCS8PEM:function t(e,r){var n=Mr(e,"ENCRYPTED PRIVATE KEY"),i=this.parseHexOfEncryptedPKCS8(n),o=tn.getPBKDF2KeyHexFromParam(i,r),s={};s.ciphertext=v.enc.Hex.parse(i.ciphertext);var a=v.enc.Hex.parse(o),u=v.enc.Hex.parse(i.encryptionSchemeIV),c=v.TripleDES.decrypt(s,a,{iv:u});return v.enc.Hex.stringify(c)},getKeyFromEncryptedPKCS8PEM:function t(e,r){var n=this._getPlainPKCS8HexFromEncryptedPKCS8PEM(e,r);return this.getKeyFromPlainPrivatePKCS8Hex(n)},parsePlainPrivatePKCS8Hex:function t(e){var r=Fr,n=r.getChildIdx,i=r.getV,o={algparam:null};if("30"!=e.substr(0,2))throw new Error("malformed plain PKCS8 private key(code:001)");var s=n(e,0);if(s.length<3)throw new Error("malformed plain PKCS8 private key(code:002)");if("30"!=e.substr(s[1],2))throw new Error("malformed PKCS8 private key(code:003)");var a=n(e,s[1]);if(2!=a.length)throw new Error("malformed PKCS8 private key(code:004)");if("06"!=e.substr(a[0],2))throw new Error("malformed PKCS8 private key(code:005)");if(o.algoid=i(e,a[0]),"06"==e.substr(a[1],2)&&(o.algparam=i(e,a[1])),"04"!=e.substr(s[2],2))throw new Error("malformed PKCS8 private key(code:006)");return o.keyidx=r.getVidx(e,s[2]),o},getKeyFromPlainPrivatePKCS8PEM:function t(e){var r=Mr(e,"PRIVATE KEY");return this.getKeyFromPlainPrivatePKCS8Hex(r)},getKeyFromPlainPrivatePKCS8Hex:function t(e){var r,n=this.parsePlainPrivatePKCS8Hex(e);if("2a864886f70d010101"==n.algoid)r=new Me;else if("2a8648ce380401"==n.algoid)r=new Sr.crypto.DSA;else{if("2a8648ce3d0201"!=n.algoid)throw new Error("unsupported private key algorithm");r=new Sr.crypto.ECDSA}return r.readPKCS8PrvKeyHex(e),r},_getKeyFromPublicPKCS8Hex:function t(e){var r,n=Fr.getVbyList(e,0,[0,0],"06");if("2a864886f70d010101"===n)r=new Me;else if("2a8648ce380401"===n)r=new Sr.crypto.DSA;else{if("2a8648ce3d0201"!==n)throw new Error("unsupported PKCS#8 public key hex");r=new Sr.crypto.ECDSA}return r.readPKCS8PubKeyHex(e),r},parsePublicRawRSAKeyHex:function t(e){var r=Fr,n=r.getChildIdx,i=r.getV,o={};if("30"!=e.substr(0,2))throw new Error("malformed RSA key(code:001)");var s=n(e,0);if(2!=s.length)throw new Error("malformed RSA key(code:002)");if("02"!=e.substr(s[0],2))throw new Error("malformed RSA key(code:003)");if(o.n=i(e,s[0]),"02"!=e.substr(s[1],2))throw new Error("malformed RSA key(code:004)");return o.e=i(e,s[1]),o},parsePublicPKCS8Hex:function t(e){var r=Fr,n=r.getChildIdx,i=r.getV,o={algparam:null},s=n(e,0);if(2!=s.length)throw new Error("outer DERSequence shall have 2 elements: "+s.length);var a=s[0];if("30"!=e.substr(a,2))throw new Error("malformed PKCS8 public key(code:001)");var u=n(e,a);if(2!=u.length)throw new Error("malformed PKCS8 public key(code:002)");if("06"!=e.substr(u[0],2))throw new Error("malformed PKCS8 public key(code:003)");if(o.algoid=i(e,u[0]),"06"==e.substr(u[1],2)?o.algparam=i(e,u[1]):"30"==e.substr(u[1],2)&&(o.algparam={},o.algparam.p=r.getVbyList(e,u[1],[0],"02"),o.algparam.q=r.getVbyList(e,u[1],[1],"02"),o.algparam.g=r.getVbyList(e,u[1],[2],"02")),"03"!=e.substr(s[1],2))throw new Error("malformed PKCS8 public key(code:004)");return o.key=i(e,s[1]).substr(2),o}}}();tn.getKey=function(t,e,r){var n=(v=Fr).getChildIdx,i=(v.getV,v.getVbyList),o=Sr.crypto,s=o.ECDSA,a=o.DSA,u=Me,c=Mr,h=tn;if(void 0!==u&&t instanceof u)return t;if(void 0!==s&&t instanceof s)return t;if(void 0!==a&&t instanceof a)return t;if(void 0!==t.curve&&void 0!==t.xy&&void 0===t.d)return new s({pub:t.xy,curve:t.curve});if(void 0!==t.curve&&void 0!==t.d)return new s({prv:t.d,curve:t.curve});if(void 0===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0===t.d)return(P=new u).setPublic(t.n,t.e),P;if(void 0===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0!==t.d&&void 0!==t.p&&void 0!==t.q&&void 0!==t.dp&&void 0!==t.dq&&void 0!==t.co&&void 0===t.qi)return(P=new u).setPrivateEx(t.n,t.e,t.d,t.p,t.q,t.dp,t.dq,t.co),P;if(void 0===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0!==t.d&&void 0===t.p)return(P=new u).setPrivate(t.n,t.e,t.d),P;if(void 0!==t.p&&void 0!==t.q&&void 0!==t.g&&void 0!==t.y&&void 0===t.x)return(P=new a).setPublic(t.p,t.q,t.g,t.y),P;if(void 0!==t.p&&void 0!==t.q&&void 0!==t.g&&void 0!==t.y&&void 0!==t.x)return(P=new a).setPrivate(t.p,t.q,t.g,t.y,t.x),P;if("RSA"===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0===t.d)return(P=new u).setPublic(Rr(t.n),Rr(t.e)),P;if("RSA"===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0!==t.d&&void 0!==t.p&&void 0!==t.q&&void 0!==t.dp&&void 0!==t.dq&&void 0!==t.qi)return(P=new u).setPrivateEx(Rr(t.n),Rr(t.e),Rr(t.d),Rr(t.p),Rr(t.q),Rr(t.dp),Rr(t.dq),Rr(t.qi)),P;if("RSA"===t.kty&&void 0!==t.n&&void 0!==t.e&&void 0!==t.d)return(P=new u).setPrivate(Rr(t.n),Rr(t.e),Rr(t.d)),P;if("EC"===t.kty&&void 0!==t.crv&&void 0!==t.x&&void 0!==t.y&&void 0===t.d){var l=(k=new s({curve:t.crv})).ecparams.keylen/4,f="04"+("0000000000"+Rr(t.x)).slice(-l)+("0000000000"+Rr(t.y)).slice(-l);return k.setPublicKeyHex(f),k}if("EC"===t.kty&&void 0!==t.crv&&void 0!==t.x&&void 0!==t.y&&void 0!==t.d){l=(k=new s({curve:t.crv})).ecparams.keylen/4,f="04"+("0000000000"+Rr(t.x)).slice(-l)+("0000000000"+Rr(t.y)).slice(-l);var g=("0000000000"+Rr(t.d)).slice(-l);return k.setPublicKeyHex(f),k.setPrivateKeyHex(g),k}if("pkcs5prv"===r){var d,p=t,v=Fr;if(9===(d=n(p,0)).length)(P=new u).readPKCS5PrvKeyHex(p);else if(6===d.length)(P=new a).readPKCS5PrvKeyHex(p);else{if(!(d.length>2&&"04"===p.substr(d[1],2)))throw new Error("unsupported PKCS#1/5 hexadecimal key");(P=new s).readPKCS5PrvKeyHex(p)}return P}if("pkcs8prv"===r)return P=h.getKeyFromPlainPrivatePKCS8Hex(t);if("pkcs8pub"===r)return h._getKeyFromPublicPKCS8Hex(t);if("x509pub"===r)return on.getPublicKeyFromCertHex(t);if(-1!=t.indexOf("-END CERTIFICATE-",0)||-1!=t.indexOf("-END X509 CERTIFICATE-",0)||-1!=t.indexOf("-END TRUSTED CERTIFICATE-",0))return on.getPublicKeyFromCertPEM(t);if(-1!=t.indexOf("-END PUBLIC KEY-")){var y=Mr(t,"PUBLIC KEY");return h._getKeyFromPublicPKCS8Hex(y)}if(-1!=t.indexOf("-END RSA PRIVATE KEY-")&&-1==t.indexOf("4,ENCRYPTED")){var m=c(t,"RSA PRIVATE KEY");return h.getKey(m,null,"pkcs5prv")}if(-1!=t.indexOf("-END DSA PRIVATE KEY-")&&-1==t.indexOf("4,ENCRYPTED")){var _=i(R=c(t,"DSA PRIVATE KEY"),0,[1],"02"),S=i(R,0,[2],"02"),w=i(R,0,[3],"02"),F=i(R,0,[4],"02"),E=i(R,0,[5],"02");return(P=new a).setPrivate(new b(_,16),new b(S,16),new b(w,16),new b(F,16),new b(E,16)),P}if(-1!=t.indexOf("-END EC PRIVATE KEY-")&&-1==t.indexOf("4,ENCRYPTED")){m=c(t,"EC PRIVATE KEY");return h.getKey(m,null,"pkcs5prv")}if(-1!=t.indexOf("-END PRIVATE KEY-"))return h.getKeyFromPlainPrivatePKCS8PEM(t);if(-1!=t.indexOf("-END RSA PRIVATE KEY-")&&-1!=t.indexOf("4,ENCRYPTED")){var x=h.getDecryptedKeyHex(t,e),A=new Me;return A.readPKCS5PrvKeyHex(x),A}if(-1!=t.indexOf("-END EC PRIVATE KEY-")&&-1!=t.indexOf("4,ENCRYPTED")){var k,P=i(R=h.getDecryptedKeyHex(t,e),0,[1],"04"),C=i(R,0,[2,0],"06"),T=i(R,0,[3,0],"03").substr(2);if(void 0===Sr.crypto.OID.oidhex2name[C])throw new Error("undefined OID(hex) in KJUR.crypto.OID: "+C);return(k=new s({curve:Sr.crypto.OID.oidhex2name[C]})).setPublicKeyHex(T),k.setPrivateKeyHex(P),k.isPublic=!1,k}if(-1!=t.indexOf("-END DSA PRIVATE KEY-")&&-1!=t.indexOf("4,ENCRYPTED")){var R;_=i(R=h.getDecryptedKeyHex(t,e),0,[1],"02"),S=i(R,0,[2],"02"),w=i(R,0,[3],"02"),F=i(R,0,[4],"02"),E=i(R,0,[5],"02");return(P=new a).setPrivate(new b(_,16),new b(S,16),new b(w,16),new b(F,16),new b(E,16)),P}if(-1!=t.indexOf("-END ENCRYPTED PRIVATE KEY-"))return h.getKeyFromEncryptedPKCS8PEM(t,e);throw new Error("not supported argument")},tn.generateKeypair=function(t,e){if("RSA"==t){var r=e;(s=new Me).generate(r,"10001"),s.isPrivate=!0,s.isPublic=!0;var n=new Me,i=s.n.toString(16),o=s.e.toString(16);return n.setPublic(i,o),n.isPrivate=!1,n.isPublic=!0,(a={}).prvKeyObj=s,a.pubKeyObj=n,a}if("EC"==t){var s,a,u=e,c=new Sr.crypto.ECDSA({curve:u}).generateKeyPairHex();return(s=new Sr.crypto.ECDSA({curve:u})).setPublicKeyHex(c.ecpubhex),s.setPrivateKeyHex(c.ecprvhex),s.isPrivate=!0,s.isPublic=!1,(n=new Sr.crypto.ECDSA({curve:u})).setPublicKeyHex(c.ecpubhex),n.isPrivate=!1,n.isPublic=!0,(a={}).prvKeyObj=s,a.pubKeyObj=n,a}throw new Error("unknown algorithm: "+t)},tn.getPEM=function(t,e,r,n,i,o){var s=Sr,a=s.asn1,u=a.DERObjectIdentifier,c=a.DERInteger,h=a.ASN1Util.newObject,l=a.x509.SubjectPublicKeyInfo,f=s.crypto,g=f.DSA,d=f.ECDSA,p=Me;function y(t){return h({seq:[{int:0},{int:{bigint:t.n}},{int:t.e},{int:{bigint:t.d}},{int:{bigint:t.p}},{int:{bigint:t.q}},{int:{bigint:t.dmp1}},{int:{bigint:t.dmq1}},{int:{bigint:t.coeff}}]})}function m(t){return h({seq:[{int:1},{octstr:{hex:t.prvKeyHex}},{tag:["a0",!0,{oid:{name:t.curveName}}]},{tag:["a1",!0,{bitstr:{hex:"00"+t.pubKeyHex}}]}]})}function _(t){return h({seq:[{int:0},{int:{bigint:t.p}},{int:{bigint:t.q}},{int:{bigint:t.g}},{int:{bigint:t.y}},{int:{bigint:t.x}}]})}if((void 0!==p&&t instanceof p||void 0!==g&&t instanceof g||void 0!==d&&t instanceof d)&&1==t.isPublic&&(void 0===e||"PKCS8PUB"==e))return jr(F=new l(t).getEncodedHex(),"PUBLIC KEY");if("PKCS1PRV"==e&&void 0!==p&&t instanceof p&&(void 0===r||null==r)&&1==t.isPrivate)return jr(F=y(t).getEncodedHex(),"RSA PRIVATE KEY");if("PKCS1PRV"==e&&void 0!==d&&t instanceof d&&(void 0===r||null==r)&&1==t.isPrivate){var S=new u({name:t.curveName}).getEncodedHex(),w=m(t).getEncodedHex(),b="";return b+=jr(S,"EC PARAMETERS"),b+=jr(w,"EC PRIVATE KEY")}if("PKCS1PRV"==e&&void 0!==g&&t instanceof g&&(void 0===r||null==r)&&1==t.isPrivate)return jr(F=_(t).getEncodedHex(),"DSA PRIVATE KEY");if("PKCS5PRV"==e&&void 0!==p&&t instanceof p&&void 0!==r&&null!=r&&1==t.isPrivate){var F=y(t).getEncodedHex();return void 0===n&&(n="DES-EDE3-CBC"),this.getEncryptedPKCS5PEMFromPrvKeyHex("RSA",F,r,n,o)}if("PKCS5PRV"==e&&void 0!==d&&t instanceof d&&void 0!==r&&null!=r&&1==t.isPrivate){F=m(t).getEncodedHex();return void 0===n&&(n="DES-EDE3-CBC"),this.getEncryptedPKCS5PEMFromPrvKeyHex("EC",F,r,n,o)}if("PKCS5PRV"==e&&void 0!==g&&t instanceof g&&void 0!==r&&null!=r&&1==t.isPrivate){F=_(t).getEncodedHex();return void 0===n&&(n="DES-EDE3-CBC"),this.getEncryptedPKCS5PEMFromPrvKeyHex("DSA",F,r,n,o)}var E=function t(e,r){var n=x(e,r);return new h({seq:[{seq:[{oid:{name:"pkcs5PBES2"}},{seq:[{seq:[{oid:{name:"pkcs5PBKDF2"}},{seq:[{octstr:{hex:n.pbkdf2Salt}},{int:n.pbkdf2Iter}]}]},{seq:[{oid:{name:"des-EDE3-CBC"}},{octstr:{hex:n.encryptionSchemeIV}}]}]}]},{octstr:{hex:n.ciphertext}}]}).getEncodedHex()},x=function t(e,r){var n=v.lib.WordArray.random(8),i=v.lib.WordArray.random(8),o=v.PBKDF2(r,n,{keySize:6,iterations:100}),s=v.enc.Hex.parse(e),a=v.TripleDES.encrypt(s,o,{iv:i})+"",u={};return u.ciphertext=a,u.pbkdf2Salt=v.enc.Hex.stringify(n),u.pbkdf2Iter=100,u.encryptionSchemeAlg="DES-EDE3-CBC",u.encryptionSchemeIV=v.enc.Hex.stringify(i),u};if("PKCS8PRV"==e&&null!=p&&t instanceof p&&1==t.isPrivate){var A=y(t).getEncodedHex();F=h({seq:[{int:0},{seq:[{oid:{name:"rsaEncryption"}},{null:!0}]},{octstr:{hex:A}}]}).getEncodedHex();return void 0===r||null==r?jr(F,"PRIVATE KEY"):jr(w=E(F,r),"ENCRYPTED PRIVATE KEY")}if("PKCS8PRV"==e&&void 0!==d&&t instanceof d&&1==t.isPrivate){A=new h({seq:[{int:1},{octstr:{hex:t.prvKeyHex}},{tag:["a1",!0,{bitstr:{hex:"00"+t.pubKeyHex}}]}]}).getEncodedHex(),F=h({seq:[{int:0},{seq:[{oid:{name:"ecPublicKey"}},{oid:{name:t.curveName}}]},{octstr:{hex:A}}]}).getEncodedHex();return void 0===r||null==r?jr(F,"PRIVATE KEY"):jr(w=E(F,r),"ENCRYPTED PRIVATE KEY")}if("PKCS8PRV"==e&&void 0!==g&&t instanceof g&&1==t.isPrivate){A=new c({bigint:t.x}).getEncodedHex(),F=h({seq:[{int:0},{seq:[{oid:{name:"dsa"}},{seq:[{int:{bigint:t.p}},{int:{bigint:t.q}},{int:{bigint:t.g}}]}]},{octstr:{hex:A}}]}).getEncodedHex();return void 0===r||null==r?jr(F,"PRIVATE KEY"):jr(w=E(F,r),"ENCRYPTED PRIVATE KEY")}throw new Error("unsupported object nor format")},tn.getKeyFromCSRPEM=function(t){var e=Mr(t,"CERTIFICATE REQUEST");return tn.getKeyFromCSRHex(e)},tn.getKeyFromCSRHex=function(t){var e=tn.parseCSRHex(t);return tn.getKey(e.p8pubkeyhex,null,"pkcs8pub")},tn.parseCSRHex=function(t){var e=Fr,r=e.getChildIdx,n=e.getTLV,i={},o=t;if("30"!=o.substr(0,2))throw new Error("malformed CSR(code:001)");var s=r(o,0);if(s.length<1)throw new Error("malformed CSR(code:002)");if("30"!=o.substr(s[0],2))throw new Error("malformed CSR(code:003)");var a=r(o,s[0]);if(a.length<3)throw new Error("malformed CSR(code:004)");return i.p8pubkeyhex=n(o,a[2]),i},tn.getKeyID=function(t){var e=tn,r=Fr;"string"==typeof t&&-1!=t.indexOf("BEGIN ")&&(t=e.getKey(t));var n=Mr(e.getPEM(t)),i=r.getIdxbyList(n,0,[1]),o=r.getV(n,i).substring(2);return Sr.crypto.Util.hashHex(o,"sha1")},tn.getJWKFromKey=function(t){var e={};if(t instanceof Me&&t.isPrivate)return e.kty="RSA",e.n=Tr(t.n.toString(16)),e.e=Tr(t.e.toString(16)),e.d=Tr(t.d.toString(16)),e.p=Tr(t.p.toString(16)),e.q=Tr(t.q.toString(16)),e.dp=Tr(t.dmp1.toString(16)),e.dq=Tr(t.dmq1.toString(16)),e.qi=Tr(t.coeff.toString(16)),e;if(t instanceof Me&&t.isPublic)return e.kty="RSA",e.n=Tr(t.n.toString(16)),e.e=Tr(t.e.toString(16)),e;if(t instanceof Sr.crypto.ECDSA&&t.isPrivate){if("P-256"!==(n=t.getShortNISTPCurveName())&&"P-384"!==n)throw new Error("unsupported curve name for JWT: "+n);var r=t.getPublicKeyXYHex();return e.kty="EC",e.crv=n,e.x=Tr(r.x),e.y=Tr(r.y),e.d=Tr(t.prvKeyHex),e}if(t instanceof Sr.crypto.ECDSA&&t.isPublic){var n;if("P-256"!==(n=t.getShortNISTPCurveName())&&"P-384"!==n)throw new Error("unsupported curve name for JWT: "+n);r=t.getPublicKeyXYHex();return e.kty="EC",e.crv=n,e.x=Tr(r.x),e.y=Tr(r.y),e}throw new Error("not supported key object")},Me.getPosArrayOfChildrenFromHex=function(t){return Fr.getChildIdx(t,0)},Me.getHexValueArrayOfChildrenFromHex=function(t){var e,r=Fr.getV,n=r(t,(e=Me.getPosArrayOfChildrenFromHex(t))[0]),i=r(t,e[1]),o=r(t,e[2]),s=r(t,e[3]),a=r(t,e[4]),u=r(t,e[5]),c=r(t,e[6]),h=r(t,e[7]),l=r(t,e[8]);return(e=new Array).push(n,i,o,s,a,u,c,h,l),e},Me.prototype.readPrivateKeyFromPEMString=function(t){var e=Mr(t),r=Me.getHexValueArrayOfChildrenFromHex(e);this.setPrivateEx(r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8])},Me.prototype.readPKCS5PrvKeyHex=function(t){var e=Me.getHexValueArrayOfChildrenFromHex(t);this.setPrivateEx(e[1],e[2],e[3],e[4],e[5],e[6],e[7],e[8])},Me.prototype.readPKCS8PrvKeyHex=function(t){var e,r,n,i,o,s,a,u,c=Fr,h=c.getVbyListEx;if(!1===c.isASN1HEX(t))throw new Error("not ASN.1 hex string");try{e=h(t,0,[2,0,1],"02"),r=h(t,0,[2,0,2],"02"),n=h(t,0,[2,0,3],"02"),i=h(t,0,[2,0,4],"02"),o=h(t,0,[2,0,5],"02"),s=h(t,0,[2,0,6],"02"),a=h(t,0,[2,0,7],"02"),u=h(t,0,[2,0,8],"02")}catch(t){throw new Error("malformed PKCS#8 plain RSA private key")}this.setPrivateEx(e,r,n,i,o,s,a,u)},Me.prototype.readPKCS5PubKeyHex=function(t){var e=Fr,r=e.getV;if(!1===e.isASN1HEX(t))throw new Error("keyHex is not ASN.1 hex string");var n=e.getChildIdx(t,0);if(2!==n.length||"02"!==t.substr(n[0],2)||"02"!==t.substr(n[1],2))throw new Error("wrong hex for PKCS#5 public key");var i=r(t,n[0]),o=r(t,n[1]);this.setPublic(i,o)},Me.prototype.readPKCS8PubKeyHex=function(t){var e=Fr;if(!1===e.isASN1HEX(t))throw new Error("not ASN.1 hex string");if("06092a864886f70d010101"!==e.getTLVbyListEx(t,0,[0,0]))throw new Error("not PKCS8 RSA public key");var r=e.getTLVbyListEx(t,0,[1,0]);this.readPKCS5PubKeyHex(r)},Me.prototype.readCertPubKeyHex=function(t,e){var r,n;(r=new on).readCertHex(t),n=r.getPublicKeyHex(),this.readPKCS8PubKeyHex(n)};new RegExp("[^0-9a-f]","gi");function en(t,e){for(var r="",n=e/4-t.length,i=0;i<n;i++)r+="0";return r+t}function rn(t,e,r){for(var n="",i=0;n.length<e;)n+=Nr(r(Lr(t+String.fromCharCode.apply(String,[(4278190080&i)>>24,(16711680&i)>>16,(65280&i)>>8,255&i])))),i+=1;return n}function nn(t){for(var e in Sr.crypto.Util.DIGESTINFOHEAD){var r=Sr.crypto.Util.DIGESTINFOHEAD[e],n=r.length;if(t.substring(0,n)==r)return[e,t.substring(n)]}return[]}function on(t){var e,r=Fr,n=r.getChildIdx,i=r.getV,o=r.getTLV,s=r.getVbyList,a=r.getVbyListEx,u=r.getTLVbyList,c=r.getTLVbyListEx,h=r.getIdxbyList,l=r.getIdxbyListEx,f=r.getVidx,g=r.getInt,d=r.oidname,p=r.hextooidstr,v=Mr;try{e=Sr.asn1.x509.AlgorithmIdentifier.PSSNAME2ASN1TLV}catch(t){}this.HEX2STAG={"0c":"utf8",13:"prn",16:"ia5","1a":"vis","1e":"bmp"},this.hex=null,this.version=0,this.foffset=0,this.aExtInfo=null,this.getVersion=function(){if(null===this.hex||0!==this.version)return this.version;var t=u(this.hex,0,[0,0]);if("a0"==t.substr(0,2)){var e=u(t,0,[0]),r=g(e,0);if(r<0||2<r)throw new Error("malformed version field");return this.version=r+1,this.version}return this.version=1,this.foffset=-1,1},this.getSerialNumberHex=function(){return a(this.hex,0,[0,0],"02")},this.getSignatureAlgorithmField=function(){var t=c(this.hex,0,[0,1]);return this.getAlgorithmIdentifierName(t)},this.getAlgorithmIdentifierName=function(t){for(var r in e)if(t===e[r])return r;return d(a(t,0,[0],"06"))},this.getIssuer=function(){return this.getX500Name(this.getIssuerHex())},this.getIssuerHex=function(){return u(this.hex,0,[0,3+this.foffset],"30")},this.getIssuerString=function(){return this.getIssuer().str},this.getSubject=function(){return this.getX500Name(this.getSubjectHex())},this.getSubjectHex=function(){return u(this.hex,0,[0,5+this.foffset],"30")},this.getSubjectString=function(){return this.getSubject().str},this.getNotBefore=function(){var t=s(this.hex,0,[0,4+this.foffset,0]);return t=t.replace(/(..)/g,"%$1"),t=decodeURIComponent(t)},this.getNotAfter=function(){var t=s(this.hex,0,[0,4+this.foffset,1]);return t=t.replace(/(..)/g,"%$1"),t=decodeURIComponent(t)},this.getPublicKeyHex=function(){return r.getTLVbyList(this.hex,0,[0,6+this.foffset],"30")},this.getPublicKeyIdx=function(){return h(this.hex,0,[0,6+this.foffset],"30")},this.getPublicKeyContentIdx=function(){var t=this.getPublicKeyIdx();return h(this.hex,t,[1,0],"30")},this.getPublicKey=function(){return tn.getKey(this.getPublicKeyHex(),null,"pkcs8pub")},this.getSignatureAlgorithmName=function(){var t=u(this.hex,0,[1],"30");return this.getAlgorithmIdentifierName(t)},this.getSignatureValueHex=function(){return s(this.hex,0,[2],"03",!0)},this.verifySignature=function(t){var e=this.getSignatureAlgorithmField(),r=this.getSignatureValueHex(),n=u(this.hex,0,[0],"30"),i=new Sr.crypto.Signature({alg:e});return i.init(t),i.updateHex(n),i.verify(r)},this.parseExt=function(t){var e,o,a;if(void 0===t){if(a=this.hex,3!==this.version)return-1;e=h(a,0,[0,7,0],"30"),o=n(a,e)}else{a=Mr(t);var u=h(a,0,[0,3,0,0],"06");if("2a864886f70d01090e"!=i(a,u))return void(this.aExtInfo=new Array);e=h(a,0,[0,3,0,1,0],"30"),o=n(a,e),this.hex=a}this.aExtInfo=new Array;for(var c=0;c<o.length;c++){var l={critical:!1},g=0;3===n(a,o[c]).length&&(l.critical=!0,g=1),l.oid=r.hextooidstr(s(a,o[c],[0],"06"));var d=h(a,o[c],[1+g]);l.vidx=f(a,d),this.aExtInfo.push(l)}},this.getExtInfo=function(t){var e=this.aExtInfo,r=t;if(t.match(/^[0-9.]+$/)||(r=Sr.asn1.x509.OID.name2oid(t)),""!==r)for(var n=0;n<e.length;n++)if(e[n].oid===r)return e[n]},this.getExtBasicConstraints=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("basicConstraints");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var n={extname:"basicConstraints"};if(e&&(n.critical=!0),"3000"===t)return n;if("30030101ff"===t)return n.cA=!0,n;if("30060101ff02"===t.substr(0,12)){var s=i(t,10),a=parseInt(s,16);return n.cA=!0,n.pathLen=a,n}throw new Error("hExtV parse error: "+t)},this.getExtKeyUsage=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("keyUsage");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var n={extname:"keyUsage"};return e&&(n.critical=!0),n.names=this.getExtKeyUsageString(t).split(","),n},this.getExtKeyUsageBin=function(t){if(void 0===t){var e=this.getExtInfo("keyUsage");if(void 0===e)return"";t=o(this.hex,e.vidx)}if(8!=t.length&&10!=t.length)throw new Error("malformed key usage value: "+t);var r="000000000000000"+parseInt(t.substr(6),16).toString(2);return 8==t.length&&(r=r.slice(-8)),10==t.length&&(r=r.slice(-16)),""==(r=r.replace(/0+$/,""))&&(r="0"),r},this.getExtKeyUsageString=function(t){for(var e=this.getExtKeyUsageBin(t),r=new Array,n=0;n<e.length;n++)"1"==e.substr(n,1)&&r.push(on.KEYUSAGE_NAME[n]);return r.join(",")},this.getExtSubjectKeyIdentifier=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("subjectKeyIdentifier");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var n={extname:"subjectKeyIdentifier"};e&&(n.critical=!0);var s=i(t,0);return n.kid={hex:s},n},this.getExtAuthorityKeyIdentifier=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("authorityKeyIdentifier");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var s={extname:"authorityKeyIdentifier"};e&&(s.critical=!0);for(var a=n(t,0),u=0;u<a.length;u++){var c=t.substr(a[u],2);if("80"===c&&(s.kid={hex:i(t,a[u])}),"a1"===c){var h=o(t,a[u]),l=this.getGeneralNames(h);s.issuer=l[0].dn}"82"===c&&(s.sn={hex:i(t,a[u])})}return s},this.getExtExtKeyUsage=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("extKeyUsage");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var s={extname:"extKeyUsage",array:[]};e&&(s.critical=!0);for(var a=n(t,0),u=0;u<a.length;u++)s.array.push(d(i(t,a[u])));return s},this.getExtExtKeyUsageName=function(){var t=this.getExtInfo("extKeyUsage");if(void 0===t)return t;var e=new Array,r=o(this.hex,t.vidx);if(""===r)return e;for(var s=n(r,0),a=0;a<s.length;a++)e.push(d(i(r,s[a])));return e},this.getExtSubjectAltName=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("subjectAltName");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var n={extname:"subjectAltName",array:[]};return e&&(n.critical=!0),n.array=this.getGeneralNames(t),n},this.getExtIssuerAltName=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("issuerAltName");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var n={extname:"issuerAltName",array:[]};return e&&(n.critical=!0),n.array=this.getGeneralNames(t),n},this.getGeneralNames=function(t){for(var e=n(t,0),r=[],i=0;i<e.length;i++){var s=this.getGeneralName(o(t,e[i]));void 0!==s&&r.push(s)}return r},this.getGeneralName=function(t){var e=t.substr(0,2),r=i(t,0),n=Nr(r);return"81"==e?{rfc822:n}:"82"==e?{dns:n}:"86"==e?{uri:n}:"87"==e?{ip:zr(r)}:"a4"==e?{dn:this.getX500Name(r)}:void 0},this.getExtSubjectAltName2=function(){var t,e,r,s=this.getExtInfo("subjectAltName");if(void 0===s)return s;for(var a=new Array,u=o(this.hex,s.vidx),c=n(u,0),h=0;h<c.length;h++)r=u.substr(c[h],2),t=i(u,c[h]),"81"===r&&(e=Dr(t),a.push(["MAIL",e])),"82"===r&&(e=Dr(t),a.push(["DNS",e])),"84"===r&&(e=on.hex2dn(t,0),a.push(["DN",e])),"86"===r&&(e=Dr(t),a.push(["URI",e])),"87"===r&&(e=zr(t),a.push(["IP",e]));return a},this.getExtCRLDistributionPoints=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("cRLDistributionPoints");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var i={extname:"cRLDistributionPoints",array:[]};e&&(i.critical=!0);for(var s=n(t,0),a=0;a<s.length;a++){var u=o(t,s[a]);i.array.push(this.getDistributionPoint(u))}return i},this.getDistributionPoint=function(t){for(var e={},r=n(t,0),i=0;i<r.length;i++){var s=t.substr(r[i],2),a=o(t,r[i]);"a0"==s&&(e.dpname=this.getDistributionPointName(a))}return e},this.getDistributionPointName=function(t){for(var e={},r=n(t,0),i=0;i<r.length;i++){var s=t.substr(r[i],2),a=o(t,r[i]);"a0"==s&&(e.full=this.getGeneralNames(a))}return e},this.getExtCRLDistributionPointsURI=function(){var t=this.getExtInfo("cRLDistributionPoints");if(void 0===t)return t;for(var e=new Array,r=n(this.hex,t.vidx),i=0;i<r.length;i++)try{var o=Dr(s(this.hex,r[i],[0,0,0],"86"));e.push(o)}catch(t){}return e},this.getExtAIAInfo=function(){var t=this.getExtInfo("authorityInfoAccess");if(void 0===t)return t;for(var e={ocsp:[],caissuer:[]},r=n(this.hex,t.vidx),i=0;i<r.length;i++){var o=s(this.hex,r[i],[0],"06"),a=s(this.hex,r[i],[1],"86");"2b06010505073001"===o&&e.ocsp.push(Dr(a)),"2b06010505073002"===o&&e.caissuer.push(Dr(a))}return e},this.getExtAuthorityInfoAccess=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("authorityInfoAccess");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var i={extname:"authorityInfoAccess",array:[]};e&&(i.critical=!0);for(var u=n(t,0),c=0;c<u.length;c++){var h=a(t,u[c],[0],"06"),l=Dr(s(t,u[c],[1],"86"));if("2b06010505073001"==h)i.array.push({ocsp:l});else{if("2b06010505073002"!=h)throw new Error("unknown method: "+h);i.array.push({caissuer:l})}}return i},this.getExtCertificatePolicies=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("certificatePolicies");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var i={extname:"certificatePolicies",array:[]};e&&(i.critical=!0);for(var s=n(t,0),a=0;a<s.length;a++){var u=o(t,s[a]),c=this.getPolicyInformation(u);i.array.push(c)}return i},this.getPolicyInformation=function(t){var e={},r=s(t,0,[0],"06");e.policyoid=d(r);var i=l(t,0,[1],"30");if(-1!=i){e.array=[];for(var a=n(t,i),u=0;u<a.length;u++){var c=o(t,a[u]),h=this.getPolicyQualifierInfo(c);e.array.push(h)}}return e},this.getPolicyQualifierInfo=function(t){var e={},r=s(t,0,[0],"06");if("2b06010505070201"===r){var n=a(t,0,[1],"16");e.cps=Nr(n)}else if("2b06010505070202"===r){var i=u(t,0,[1],"30");e.unotice=this.getUserNotice(i)}return e},this.getUserNotice=function(t){for(var e={},r=n(t,0),i=0;i<r.length;i++){var s=o(t,r[i]);"30"!=s.substr(0,2)&&(e.exptext=this.getDisplayText(s))}return e},this.getDisplayText=function(t){var e={};return e.type={"0c":"utf8",16:"ia5","1a":"vis","1e":"bmp"}[t.substr(0,2)],e.str=Nr(i(t,0)),e},this.getExtCRLNumber=function(t,e){var r={extname:"cRLNumber"};if(e&&(r.critical=!0),"02"==t.substr(0,2))return r.num={hex:i(t,0)},r;throw new Error("hExtV parse error: "+t)},this.getExtCRLReason=function(t,e){var r={extname:"cRLReason"};if(e&&(r.critical=!0),"0a"==t.substr(0,2))return r.code=parseInt(i(t,0),16),r;throw new Error("hExtV parse error: "+t)},this.getExtOcspNonce=function(t,e){var r={extname:"ocspNonce"};e&&(r.critical=!0);var n=i(t,0);return r.hex=n,r},this.getExtOcspNoCheck=function(t,e){var r={extname:"ocspNoCheck"};return e&&(r.critical=!0),r},this.getExtAdobeTimeStamp=function(t,e){if(void 0===t&&void 0===e){var r=this.getExtInfo("adobeTimeStamp");if(void 0===r)return;t=o(this.hex,r.vidx),e=r.critical}var i={extname:"adobeTimeStamp"};e&&(i.critical=!0);var s=n(t,0);if(s.length>1){var a=o(t,s[1]),u=this.getGeneralName(a);null!=u.uri&&(i.uri=u.uri)}if(s.length>2){var c=o(t,s[2]);"0101ff"==c&&(i.reqauth=!0),"010100"==c&&(i.reqauth=!1)}return i},this.getX500NameRule=function(t){for(var e=null,r=[],n=0;n<t.length;n++)for(var i=t[n],o=0;o<i.length;o++)r.push(i[o]);for(n=0;n<r.length;n++){var s=r[n],a=s.ds,u=s.value,c=s.type;if(":"+a,"prn"!=a&&"utf8"!=a&&"ia5"!=a)return"mixed";if("ia5"==a){if("CN"!=c)return"mixed";if(Sr.lang.String.isMail(u))continue;return"mixed"}if("C"==c){if("prn"==a)continue;return"mixed"}if(":"+a,null==e)e=a;else if(e!==a)return"mixed"}return null==e?"prn":e},this.getX500Name=function(t){var e=this.getX500NameArray(t);return{array:e,str:this.dnarraytostr(e)}},this.getX500NameArray=function(t){for(var e=[],r=n(t,0),i=0;i<r.length;i++)e.push(this.getRDN(o(t,r[i])));return e},this.getRDN=function(t){for(var e=[],r=n(t,0),i=0;i<r.length;i++)e.push(this.getAttrTypeAndValue(o(t,r[i])));return e},this.getAttrTypeAndValue=function(t){var e={type:null,value:null,ds:null},r=n(t,0),i=s(t,r[0],[],"06"),o=s(t,r[1],[]),a=Sr.asn1.ASN1Util.oidHexToInt(i);return e.type=Sr.asn1.x509.OID.oid2atype(a),e.ds=this.HEX2STAG[t.substr(r[1],2)],"bmp"!=e.ds?e.value=Dr(o):e.value=Yr(o),e},this.readCertPEM=function(t){this.readCertHex(v(t))},this.readCertHex=function(t){this.hex=t,this.getVersion();try{h(this.hex,0,[0,7],"a3"),this.parseExt()}catch(t){}},this.getParam=function(){var t={};return t.version=this.getVersion(),t.serial={hex:this.getSerialNumberHex()},t.sigalg=this.getSignatureAlgorithmField(),t.issuer=this.getIssuer(),t.notbefore=this.getNotBefore(),t.notafter=this.getNotAfter(),t.subject=this.getSubject(),t.sbjpubkey=jr(this.getPublicKeyHex(),"PUBLIC KEY"),this.aExtInfo.length>0&&(t.ext=this.getExtParamArray()),t.sighex=this.getSignatureValueHex(),t},this.getExtParamArray=function(t){null==t&&(-1!=l(this.hex,0,[0,"[3]"])&&(t=c(this.hex,0,[0,"[3]",0],"30")));for(var e=[],r=n(t,0),i=0;i<r.length;i++){var s=o(t,r[i]),a=this.getExtParam(s);null!=a&&e.push(a)}return e},this.getExtParam=function(t){var e=n(t,0).length;if(2!=e&&3!=e)throw new Error("wrong number elements in Extension: "+e+" "+t);var r=p(s(t,0,[0],"06")),i=!1;3==e&&"0101ff"==u(t,0,[1])&&(i=!0);var o=u(t,0,[e-1,0]),a=void 0;if("2.5.29.14"==r?a=this.getExtSubjectKeyIdentifier(o,i):"2.5.29.15"==r?a=this.getExtKeyUsage(o,i):"2.5.29.17"==r?a=this.getExtSubjectAltName(o,i):"2.5.29.18"==r?a=this.getExtIssuerAltName(o,i):"2.5.29.19"==r?a=this.getExtBasicConstraints(o,i):"2.5.29.31"==r?a=this.getExtCRLDistributionPoints(o,i):"2.5.29.32"==r?a=this.getExtCertificatePolicies(o,i):"2.5.29.35"==r?a=this.getExtAuthorityKeyIdentifier(o,i):"2.5.29.37"==r?a=this.getExtExtKeyUsage(o,i):"1.3.6.1.5.5.7.1.1"==r?a=this.getExtAuthorityInfoAccess(o,i):"2.5.29.20"==r?a=this.getExtCRLNumber(o,i):"2.5.29.21"==r?a=this.getExtCRLReason(o,i):"1.3.6.1.5.5.7.48.1.2"==r?a=this.getExtOcspNonce(o,i):"1.3.6.1.5.5.7.48.1.5"==r?a=this.getExtOcspNoCheck(o,i):"1.2.840.113583.1.1.9.1"==r&&(a=this.getExtAdobeTimeStamp(o,i)),null!=a)return a;var c={extname:r,extn:o};return i&&(c.critical=!0),c},this.findExt=function(t,e){for(var r=0;r<t.length;r++)if(t[r].extname==e)return t[r];return null},this.updateExtCDPFullURI=function(t,e){var r=this.findExt(t,"cRLDistributionPoints");if(null!=r&&null!=r.array)for(var n=r.array,i=0;i<n.length;i++)if(null!=n[i].dpname&&null!=n[i].dpname.full)for(var o=n[i].dpname.full,s=0;s<o.length;s++){var a=o[i];null!=a.uri&&(a.uri=e)}},this.updateExtAIAOCSP=function(t,e){var r=this.findExt(t,"authorityInfoAccess");if(null!=r&&null!=r.array)for(var n=r.array,i=0;i<n.length;i++)null!=n[i].ocsp&&(n[i].ocsp=e)},this.updateExtAIACAIssuer=function(t,e){var r=this.findExt(t,"authorityInfoAccess");if(null!=r&&null!=r.array)for(var n=r.array,i=0;i<n.length;i++)null!=n[i].caissuer&&(n[i].caissuer=e)},this.dnarraytostr=function(t){return"/"+t.map((function(t){return function e(t){return t.map((function(t){return function e(t){return t.type+"="+t.value}(t).replace(/\+/,"\\+")})).join("+")}(t).replace(/\//,"\\/")})).join("/")},this.getInfo=function(){var t,e,r,n=function t(e){return JSON.stringify(e.array).replace(/[\[\]\{\}\"]/g,"")},i=function t(e){for(var r="",n=e.array,i=0;i<n.length;i++){var o=n[i];if(r+="    policy oid: "+o.policyoid+"\n",void 0!==o.array)for(var s=0;s<o.array.length;s++){var a=o.array[s];void 0!==a.cps&&(r+="    cps: "+a.cps+"\n")}}return r},o=function t(e){for(var r="",n=e.array,i=0;i<n.length;i++){var o=n[i];try{void 0!==o.dpname.full[0].uri&&(r+="    "+o.dpname.full[0].uri+"\n")}catch(t){}try{void 0!==o.dname.full[0].dn.hex&&(r+="    "+on.hex2dn(o.dpname.full[0].dn.hex)+"\n")}catch(t){}}return r},s=function t(e){for(var r="",n=e.array,i=0;i<n.length;i++){var o=n[i];void 0!==o.caissuer&&(r+="    caissuer: "+o.caissuer+"\n"),void 0!==o.ocsp&&(r+="    ocsp: "+o.ocsp+"\n")}return r};if(t="Basic Fields\n",t+="  serial number: "+this.getSerialNumberHex()+"\n",t+="  signature algorithm: "+this.getSignatureAlgorithmField()+"\n",t+="  issuer: "+this.getIssuerString()+"\n",t+="  notBefore: "+this.getNotBefore()+"\n",t+="  notAfter: "+this.getNotAfter()+"\n",t+="  subject: "+this.getSubjectString()+"\n",t+="  subject public key info: \n",t+="    key algorithm: "+(e=this.getPublicKey()).type+"\n","RSA"===e.type&&(t+="    n="+$r(e.n.toString(16)).substr(0,16)+"...\n",t+="    e="+$r(e.e.toString(16))+"\n"),null!=(r=this.aExtInfo)){t+="X509v3 Extensions:\n";for(var a=0;a<r.length;a++){var u=r[a],c=Sr.asn1.x509.OID.oid2name(u.oid);""===c&&(c=u.oid);var h="";if(!0===u.critical&&(h="CRITICAL"),t+="  "+c+" "+h+":\n","basicConstraints"===c){var l=this.getExtBasicConstraints();void 0===l.cA?t+="    {}\n":(t+="    cA=true",void 0!==l.pathLen&&(t+=", pathLen="+l.pathLen),t+="\n")}else if("keyUsage"===c)t+="    "+this.getExtKeyUsageString()+"\n";else if("subjectKeyIdentifier"===c)t+="    "+this.getExtSubjectKeyIdentifier().kid.hex+"\n";else if("authorityKeyIdentifier"===c){var f=this.getExtAuthorityKeyIdentifier();void 0!==f.kid&&(t+="    kid="+f.kid.hex+"\n")}else{if("extKeyUsage"===c)t+="    "+this.getExtExtKeyUsage().array.join(", ")+"\n";else if("subjectAltName"===c)t+="    "+n(this.getExtSubjectAltName())+"\n";else if("cRLDistributionPoints"===c)t+=o(this.getExtCRLDistributionPoints());else if("authorityInfoAccess"===c)t+=s(this.getExtAuthorityInfoAccess());else"certificatePolicies"===c&&(t+=i(this.getExtCertificatePolicies()))}}}return t+="signature algorithm: "+this.getSignatureAlgorithmName()+"\n",t+="signature: "+this.getSignatureValueHex().substr(0,16)+"...\n"},"string"==typeof t&&(-1!=t.indexOf("-----BEGIN")?this.readCertPEM(t):Sr.lang.String.isHex(t)&&this.readCertHex(t))}Me.prototype.sign=function(t,e){var r=function t(r){return Sr.crypto.Util.hashString(r,e)}(t);return this.signWithMessageHash(r,e)},Me.prototype.signWithMessageHash=function(t,e){var r=Oe(Sr.crypto.Util.getPaddedDigestInfoHex(t,e,this.n.bitLength()),16);return en(this.doPrivate(r).toString(16),this.n.bitLength())},Me.prototype.signPSS=function(t,e,r){var n=function t(r){return Sr.crypto.Util.hashHex(r,e)}(Lr(t));return void 0===r&&(r=-1),this.signWithMessageHashPSS(n,e,r)},Me.prototype.signWithMessageHashPSS=function(t,e,r){var n,i=Nr(t),o=i.length,s=this.n.bitLength()-1,a=Math.ceil(s/8),u=function t(r){return Sr.crypto.Util.hashHex(r,e)};if(-1===r||void 0===r)r=o;else if(-2===r)r=a-o-2;else if(r<-2)throw new Error("invalid salt length");if(a<o+r+2)throw new Error("data too long");var c="";r>0&&(c=new Array(r),(new Be).nextBytes(c),c=String.fromCharCode.apply(String,c));var h=Nr(u(Lr("\0\0\0\0\0\0\0\0"+i+c))),l=[];for(n=0;n<a-r-o-2;n+=1)l[n]=0;var f=String.fromCharCode.apply(String,l)+""+c,g=rn(h,f.length,u),d=[];for(n=0;n<f.length;n+=1)d[n]=f.charCodeAt(n)^g.charCodeAt(n);var p=65280>>8*a-s&255;for(d[0]&=~p,n=0;n<o;n++)d.push(h.charCodeAt(n));return d.push(188),en(this.doPrivate(new b(d)).toString(16),this.n.bitLength())},Me.prototype.verify=function(t,e){if(null==(e=e.toLowerCase()).match(/^[0-9a-f]+$/))return!1;var r=Oe(e,16),n=this.n.bitLength();if(r.bitLength()>n)return!1;var i=this.doPublic(r).toString(16);if(i.length+3!=n/4)return!1;var o=nn(i.replace(/^1f+00/,""));if(0==o.length)return!1;var s=o[0];return o[1]==function t(e){return Sr.crypto.Util.hashString(e,s)}(t)},Me.prototype.verifyWithMessageHash=function(t,e){if(e.length!=Math.ceil(this.n.bitLength()/4))return!1;var r=Oe(e,16);if(r.bitLength()>this.n.bitLength())return 0;var n=nn(this.doPublic(r).toString(16).replace(/^1f+00/,""));if(0==n.length)return!1;n[0];return n[1]==t},Me.prototype.verifyPSS=function(t,e,r,n){var i=function t(e){return Sr.crypto.Util.hashHex(e,r)}(Lr(t));return void 0===n&&(n=-1),this.verifyWithMessageHashPSS(i,e,r,n)},Me.prototype.verifyWithMessageHashPSS=function(t,e,r,n){if(e.length!=Math.ceil(this.n.bitLength()/4))return!1;var i,o=new b(e,16),s=function t(e){return Sr.crypto.Util.hashHex(e,r)},a=Nr(t),u=a.length,c=this.n.bitLength()-1,h=Math.ceil(c/8);if(-1===n||void 0===n)n=u;else if(-2===n)n=h-u-2;else if(n<-2)throw new Error("invalid salt length");if(h<u+n+2)throw new Error("data too long");var l=this.doPublic(o).toByteArray();for(i=0;i<l.length;i+=1)l[i]&=255;for(;l.length<h;)l.unshift(0);if(188!==l[h-1])throw new Error("encoded message does not end in 0xbc");var f=(l=String.fromCharCode.apply(String,l)).substr(0,h-u-1),g=l.substr(f.length,u),d=65280>>8*h-c&255;if(0!=(f.charCodeAt(0)&d))throw new Error("bits beyond keysize not zero");var p=rn(g,f.length,s),v=[];for(i=0;i<f.length;i+=1)v[i]=f.charCodeAt(i)^p.charCodeAt(i);v[0]&=~d;var y=h-u-n-2;for(i=0;i<y;i+=1)if(0!==v[i])throw new Error("leftmost octets not zero");if(1!==v[y])throw new Error("0x01 marker not found");return g===Nr(s(Lr("\0\0\0\0\0\0\0\0"+a+String.fromCharCode.apply(String,v.slice(-n)))))},Me.SALT_LEN_HLEN=-1,Me.SALT_LEN_MAX=-2,Me.SALT_LEN_RECOVER=-2,on.hex2dn=function(t,e){void 0===e&&(e=0);var r=new on;Fr.getTLV(t,e);return r.getX500Name(t).str},on.hex2rdn=function(t,e){if(void 0===e&&(e=0),"31"!==t.substr(e,2))throw new Error("malformed RDN");for(var r=new Array,n=Fr.getChildIdx(t,e),i=0;i<n.length;i++)r.push(on.hex2attrTypeValue(t,n[i]));return(r=r.map((function(t){return t.replace("+","\\+")}))).join("+")},on.hex2attrTypeValue=function(t,e){var r=Fr,n=r.getV;if(void 0===e&&(e=0),"30"!==t.substr(e,2))throw new Error("malformed attribute type and value");var i=r.getChildIdx(t,e);2!==i.length||t.substr(i[0],2);var o=n(t,i[0]),s=Sr.asn1.ASN1Util.oidHexToInt(o);return Sr.asn1.x509.OID.oid2atype(s)+"="+Nr(n(t,i[1]))},on.getPublicKeyFromCertHex=function(t){var e=new on;return e.readCertHex(t),e.getPublicKey()},on.getPublicKeyFromCertPEM=function(t){var e=new on;return e.readCertPEM(t),e.getPublicKey()},on.getPublicKeyInfoPropOfCertPEM=function(t){var e,r,n=Fr.getVbyList,i={};return i.algparam=null,(e=new on).readCertPEM(t),r=e.getPublicKeyHex(),i.keyhex=n(r,0,[1],"03").substr(2),i.algoid=n(r,0,[0,0],"06"),"2a8648ce3d0201"===i.algoid&&(i.algparam=n(r,0,[0,1],"06")),i},on.KEYUSAGE_NAME=["digitalSignature","nonRepudiation","keyEncipherment","dataEncipherment","keyAgreement","keyCertSign","cRLSign","encipherOnly","decipherOnly"],void 0!==Sr&&Sr||(e.KJUR=Sr={}),void 0!==Sr.jws&&Sr.jws||(Sr.jws={}),Sr.jws.JWS=function(){var t=Sr.jws.JWS.isSafeJSONString;this.parseJWS=function(e,r){if(void 0===this.parsedJWS||!r&&void 0===this.parsedJWS.sigvalH){var n=e.match(/^([^.]+)\.([^.]+)\.([^.]+)$/);if(null==n)throw"JWS signature is not a form of 'Head.Payload.SigValue'.";var i=n[1],o=n[2],s=n[3],a=i+"."+o;if(this.parsedJWS={},this.parsedJWS.headB64U=i,this.parsedJWS.payloadB64U=o,this.parsedJWS.sigvalB64U=s,this.parsedJWS.si=a,!r){var u=Rr(s),c=Oe(u,16);this.parsedJWS.sigvalH=u,this.parsedJWS.sigvalBI=c}var h=br(i),l=br(o);if(this.parsedJWS.headS=h,this.parsedJWS.payloadS=l,!t(h,this.parsedJWS,"headP"))throw"malformed JSON string for JWS Head: "+h}}},Sr.jws.JWS.sign=function(t,e,r,n,i){var o,s,a,u=Sr,c=u.jws.JWS,h=c.readSafeJSONString,l=c.isSafeJSONString,f=u.crypto,d=(f.ECDSA,f.Mac),p=f.Signature,v=JSON;if("string"!=typeof e&&"object"!=(void 0===e?"undefined":g(e)))throw"spHeader must be JSON string or object: "+e;if("object"==(void 0===e?"undefined":g(e))&&(s=e,o=v.stringify(s)),"string"==typeof e){if(!l(o=e))throw"JWS Head is not safe JSON string: "+o;s=h(o)}if(a=r,"object"==(void 0===r?"undefined":g(r))&&(a=v.stringify(r)),""!=t&&null!=t||void 0===s.alg||(t=s.alg),""!=t&&null!=t&&void 0===s.alg&&(s.alg=t,o=v.stringify(s)),t!==s.alg)throw"alg and sHeader.alg doesn't match: "+t+"!="+s.alg;var y=null;if(void 0===c.jwsalg2sigalg[t])throw"unsupported alg name: "+t;y=c.jwsalg2sigalg[t];var m=wr(o)+"."+wr(a),_="";if("Hmac"==y.substr(0,4)){if(void 0===n)throw"mac key shall be specified for HS* alg";var S=new d({alg:y,prov:"cryptojs",pass:n});S.updateString(m),_=S.doFinal()}else if(-1!=y.indexOf("withECDSA")){(b=new p({alg:y})).init(n,i),b.updateString(m);var w=b.sign();_=Sr.crypto.ECDSA.asn1SigToConcatSig(w)}else{var b;if("none"!=y)(b=new p({alg:y})).init(n,i),b.updateString(m),_=b.sign()}return m+"."+Tr(_)},Sr.jws.JWS.verify=function(t,e,r){var n,i=Sr,o=i.jws.JWS,s=o.readSafeJSONString,a=i.crypto,u=a.ECDSA,c=a.Mac,h=a.Signature;void 0!==g(Me)&&(n=Me);var l=t.split(".");if(3!==l.length)return!1;var f=l[0]+"."+l[1],d=Rr(l[2]),p=s(br(l[0])),v=null,y=null;if(void 0===p.alg)throw"algorithm not specified in header";if((y=(v=p.alg).substr(0,2),null!=r&&"[object Array]"===Object.prototype.toString.call(r)&&r.length>0)&&-1==(":"+r.join(":")+":").indexOf(":"+v+":"))throw"algorithm '"+v+"' not accepted in the list";if("none"!=v&&null===e)throw"key shall be specified to verify.";if("string"==typeof e&&-1!=e.indexOf("-----BEGIN ")&&(e=tn.getKey(e)),!("RS"!=y&&"PS"!=y||e instanceof n))throw"key shall be a RSAKey obj for RS* and PS* algs";if("ES"==y&&!(e instanceof u))throw"key shall be a ECDSA obj for ES* algs";var m=null;if(void 0===o.jwsalg2sigalg[p.alg])throw"unsupported alg name: "+v;if("none"==(m=o.jwsalg2sigalg[v]))throw"not supported";if("Hmac"==m.substr(0,4)){if(void 0===e)throw"hexadecimal key shall be specified for HMAC";var _=new c({alg:m,pass:e});return _.updateString(f),d==_.doFinal()}if(-1!=m.indexOf("withECDSA")){var S,w=null;try{w=u.concatSigToASN1Sig(d)}catch(t){return!1}return(S=new h({alg:m})).init(e),S.updateString(f),S.verify(w)}return(S=new h({alg:m})).init(e),S.updateString(f),S.verify(d)},Sr.jws.JWS.parse=function(t){var e,r,n,i=t.split("."),o={};if(2!=i.length&&3!=i.length)throw"malformed sJWS: wrong number of '.' splitted elements";return e=i[0],r=i[1],3==i.length&&(n=i[2]),o.headerObj=Sr.jws.JWS.readSafeJSONString(br(e)),o.payloadObj=Sr.jws.JWS.readSafeJSONString(br(r)),o.headerPP=JSON.stringify(o.headerObj,null,"  "),null==o.payloadObj?o.payloadPP=br(r):o.payloadPP=JSON.stringify(o.payloadObj,null,"  "),void 0!==n&&(o.sigHex=Rr(n)),o},Sr.jws.JWS.verifyJWT=function(t,e,r){var n=Sr.jws,i=n.JWS,o=i.readSafeJSONString,s=i.inArray,a=i.includedArray,u=t.split("."),c=u[0],h=u[1],l=(Rr(u[2]),o(br(c))),f=o(br(h));if(void 0===l.alg)return!1;if(void 0===r.alg)throw"acceptField.alg shall be specified";if(!s(l.alg,r.alg))return!1;if(void 0!==f.iss&&"object"===g(r.iss)&&!s(f.iss,r.iss))return!1;if(void 0!==f.sub&&"object"===g(r.sub)&&!s(f.sub,r.sub))return!1;if(void 0!==f.aud&&"object"===g(r.aud))if("string"==typeof f.aud){if(!s(f.aud,r.aud))return!1}else if("object"==g(f.aud)&&!a(f.aud,r.aud))return!1;var d=n.IntDate.getNow();return void 0!==r.verifyAt&&"number"==typeof r.verifyAt&&(d=r.verifyAt),void 0!==r.gracePeriod&&"number"==typeof r.gracePeriod||(r.gracePeriod=0),!(void 0!==f.exp&&"number"==typeof f.exp&&f.exp+r.gracePeriod<d)&&(!(void 0!==f.nbf&&"number"==typeof f.nbf&&d<f.nbf-r.gracePeriod)&&(!(void 0!==f.iat&&"number"==typeof f.iat&&d<f.iat-r.gracePeriod)&&((void 0===f.jti||void 0===r.jti||f.jti===r.jti)&&!!i.verify(t,e,r.alg))))},Sr.jws.JWS.includedArray=function(t,e){var r=Sr.jws.JWS.inArray;if(null===t)return!1;if("object"!==(void 0===t?"undefined":g(t)))return!1;if("number"!=typeof t.length)return!1;for(var n=0;n<t.length;n++)if(!r(t[n],e))return!1;return!0},Sr.jws.JWS.inArray=function(t,e){if(null===e)return!1;if("object"!==(void 0===e?"undefined":g(e)))return!1;if("number"!=typeof e.length)return!1;for(var r=0;r<e.length;r++)if(e[r]==t)return!0;return!1},Sr.jws.JWS.jwsalg2sigalg={HS256:"HmacSHA256",HS384:"HmacSHA384",HS512:"HmacSHA512",RS256:"SHA256withRSA",RS384:"SHA384withRSA",RS512:"SHA512withRSA",ES256:"SHA256withECDSA",ES384:"SHA384withECDSA",PS256:"SHA256withRSAandMGF1",PS384:"SHA384withRSAandMGF1",PS512:"SHA512withRSAandMGF1",none:"none"},Sr.jws.JWS.isSafeJSONString=function(t,e,r){var n=null;try{return"object"!=(void 0===(n=_r(t))?"undefined":g(n))||n.constructor===Array?0:(e&&(e[r]=n),1)}catch(t){return 0}},Sr.jws.JWS.readSafeJSONString=function(t){var e=null;try{return"object"!=(void 0===(e=_r(t))?"undefined":g(e))||e.constructor===Array?null:e}catch(t){return null}},Sr.jws.JWS.getEncodedSignatureValueFromJWS=function(t){var e=t.match(/^[^.]+\.[^.]+\.([^.]+)$/);if(null==e)throw"JWS signature is not a form of 'Head.Payload.SigValue'.";return e[1]},Sr.jws.JWS.getJWKthumbprint=function(t){if("RSA"!==t.kty&&"EC"!==t.kty&&"oct"!==t.kty)throw"unsupported algorithm for JWK Thumprint";var e="{";if("RSA"===t.kty){if("string"!=typeof t.n||"string"!=typeof t.e)throw"wrong n and e value for RSA key";e+='"e":"'+t.e+'",',e+='"kty":"'+t.kty+'",',e+='"n":"'+t.n+'"}'}else if("EC"===t.kty){if("string"!=typeof t.crv||"string"!=typeof t.x||"string"!=typeof t.y)throw"wrong crv, x and y value for EC key";e+='"crv":"'+t.crv+'",',e+='"kty":"'+t.kty+'",',e+='"x":"'+t.x+'",',e+='"y":"'+t.y+'"}'}else if("oct"===t.kty){if("string"!=typeof t.k)throw"wrong k value for oct(symmetric) key";e+='"kty":"'+t.kty+'",',e+='"k":"'+t.k+'"}'}var r=Lr(e);return Tr(Sr.crypto.Util.hashHex(r,"sha256"))},Sr.jws.IntDate={},Sr.jws.IntDate.get=function(t){var e=Sr.jws.IntDate,r=e.getNow,n=e.getZulu;if("now"==t)return r();if("now + 1hour"==t)return r()+3600;if("now + 1day"==t)return r()+86400;if("now + 1month"==t)return r()+2592e3;if("now + 1year"==t)return r()+31536e3;if(t.match(/Z$/))return n(t);if(t.match(/^[0-9]+$/))return parseInt(t);throw"unsupported format: "+t},Sr.jws.IntDate.getZulu=function(t){return Vr(t)},Sr.jws.IntDate.getNow=function(){return~~(new Date/1e3)},Sr.jws.IntDate.intDate2UTCString=function(t){return new Date(1e3*t).toUTCString()},Sr.jws.IntDate.intDate2Zulu=function(t){var e=new Date(1e3*t);return("0000"+e.getUTCFullYear()).slice(-4)+("00"+(e.getUTCMonth()+1)).slice(-2)+("00"+e.getUTCDate()).slice(-2)+("00"+e.getUTCHours()).slice(-2)+("00"+e.getUTCMinutes()).slice(-2)+("00"+e.getUTCSeconds()).slice(-2)+"Z"},e.SecureRandom=Be,e.rng_seed_time=Re,e.BigInteger=b,e.RSAKey=Me;var sn=Sr.crypto.EDSA;e.EDSA=sn;var an=Sr.crypto.DSA;e.DSA=an;var un=Sr.crypto.Signature;e.Signature=un;var cn=Sr.crypto.MessageDigest;e.MessageDigest=cn;var hn=Sr.crypto.Mac;e.Mac=hn;var ln=Sr.crypto.Cipher;e.Cipher=ln,e.KEYUTIL=tn,e.ASN1HEX=Fr,e.X509=on,e.CryptoJS=v,e.b64tohex=S,e.b64toBA=w,e.stoBA=Er,e.BAtos=xr,e.BAtohex=Ar,e.stohex=kr,e.stob64=function fn(t){return _(kr(t))},e.stob64u=function gn(t){return Pr(_(kr(t)))},e.b64utos=function dn(t){return xr(w(Cr(t)))},e.b64tob64u=Pr,e.b64utob64=Cr,e.hex2b64=_,e.hextob64u=Tr,e.b64utohex=Rr,e.utf8tob64u=wr,e.b64utoutf8=br,e.utf8tob64=function pn(t){return _(Kr(Gr(t)))},e.b64toutf8=function vn(t){return decodeURIComponent(qr(S(t)))},e.utf8tohex=Ir,e.hextoutf8=Dr,e.hextorstr=Nr,e.rstrtohex=Lr,e.hextob64=Ur,e.hextob64nl=Br,e.b64nltohex=Or,e.hextopem=jr,e.pemtohex=Mr,e.hextoArrayBuffer=function yn(t){if(t.length%2!=0)throw"input is not even length";if(null==t.match(/^[0-9A-Fa-f]+$/))throw"input is not hexadecimal";for(var e=new ArrayBuffer(t.length/2),r=new DataView(e),n=0;n<t.length/2;n++)r.setUint8(n,parseInt(t.substr(2*n,2),16));return e},e.ArrayBuffertohex=function mn(t){for(var e="",r=new DataView(t),n=0;n<t.byteLength;n++)e+=("00"+r.getUint8(n).toString(16)).slice(-2);return e},e.zulutomsec=Hr,e.zulutosec=Vr,e.zulutodate=function _n(t){return new Date(Hr(t))},e.datetozulu=function Sn(t,e,r){var n,i=t.getUTCFullYear();if(e){if(i<1950||2049<i)throw"not proper year for UTCTime: "+i;n=(""+i).slice(-2)}else n=("000"+i).slice(-4);if(n+=("0"+(t.getUTCMonth()+1)).slice(-2),n+=("0"+t.getUTCDate()).slice(-2),n+=("0"+t.getUTCHours()).slice(-2),n+=("0"+t.getUTCMinutes()).slice(-2),n+=("0"+t.getUTCSeconds()).slice(-2),r){var o=t.getUTCMilliseconds();0!==o&&(n+="."+(o=(o=("00"+o).slice(-3)).replace(/0+$/g,"")))}return n+="Z"},e.uricmptohex=Kr,e.hextouricmp=qr,e.ipv6tohex=Jr,e.hextoipv6=Wr,e.hextoip=zr,e.iptohex=function wn(t){var e="malformed IP address";if(!(t=t.toLowerCase(t)).match(/^[0-9.]+$/)){if(t.match(/^[0-9a-f:]+$/)&&-1!==t.indexOf(":"))return Jr(t);throw e}var r=t.split(".");if(4!==r.length)throw e;var n="";try{for(var i=0;i<4;i++){n+=("0"+parseInt(r[i]).toString(16)).slice(-2)}return n}catch(t){throw e}},e.encodeURIComponentAll=Gr,e.newline_toUnix=function bn(t){return t=t.replace(/\r\n/gm,"\n")},e.newline_toDos=function Fn(t){return t=(t=t.replace(/\r\n/gm,"\n")).replace(/\n/gm,"\r\n")},e.hextoposhex=$r,e.intarystrtohex=function En(t){t=(t=(t=t.replace(/^\s*\[\s*/,"")).replace(/\s*\]\s*$/,"")).replace(/\s*/g,"");try{return t.split(/,/).map((function(t,e,r){var n=parseInt(t);if(n<0||255<n)throw"integer not in range 0-255";return("00"+n.toString(16)).slice(-2)})).join("")}catch(t){throw"malformed integer array string: "+t}},e.strdiffidx=function t(e,r){var n=e.length;e.length>r.length&&(n=r.length);for(var i=0;i<n;i++)if(e.charCodeAt(i)!=r.charCodeAt(i))return i;return e.length!=r.length?n:-1},e.KJUR=Sr;var xn=Sr.crypto;e.crypto=xn;var An=Sr.asn1;e.asn1=An;var kn=Sr.jws;e.jws=kn;var Pn=Sr.lang;e.lang=Pn}).call(this,r(28).Buffer)},function(t,e,r){"use strict";(function(t){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <http://feross.org>
 * @license  MIT
 */
var n=r(30),i=r(31),o=r(32);function s(){return u.TYPED_ARRAY_SUPPORT?2147483647:1073741823}function a(t,e){if(s()<e)throw new RangeError("Invalid typed array length");return u.TYPED_ARRAY_SUPPORT?(t=new Uint8Array(e)).__proto__=u.prototype:(null===t&&(t=new u(e)),t.length=e),t}function u(t,e,r){if(!(u.TYPED_ARRAY_SUPPORT||this instanceof u))return new u(t,e,r);if("number"==typeof t){if("string"==typeof e)throw new Error("If encoding is specified then the first argument must be a string");return l(this,t)}return c(this,t,e,r)}function c(t,e,r,n){if("number"==typeof e)throw new TypeError('"value" argument must not be a number');return"undefined"!=typeof ArrayBuffer&&e instanceof ArrayBuffer?function i(t,e,r,n){if(e.byteLength,r<0||e.byteLength<r)throw new RangeError("'offset' is out of bounds");if(e.byteLength<r+(n||0))throw new RangeError("'length' is out of bounds");e=void 0===r&&void 0===n?new Uint8Array(e):void 0===n?new Uint8Array(e,r):new Uint8Array(e,r,n);u.TYPED_ARRAY_SUPPORT?(t=e).__proto__=u.prototype:t=f(t,e);return t}(t,e,r,n):"string"==typeof e?function s(t,e,r){"string"==typeof r&&""!==r||(r="utf8");if(!u.isEncoding(r))throw new TypeError('"encoding" must be a valid string encoding');var n=0|d(e,r),i=(t=a(t,n)).write(e,r);i!==n&&(t=t.slice(0,i));return t}(t,e,r):function c(t,e){if(u.isBuffer(e)){var r=0|g(e.length);return 0===(t=a(t,r)).length||e.copy(t,0,0,r),t}if(e){if("undefined"!=typeof ArrayBuffer&&e.buffer instanceof ArrayBuffer||"length"in e)return"number"!=typeof e.length||function n(t){return t!=t}(e.length)?a(t,0):f(t,e);if("Buffer"===e.type&&o(e.data))return f(t,e.data)}throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.")}(t,e)}function h(t){if("number"!=typeof t)throw new TypeError('"size" argument must be a number');if(t<0)throw new RangeError('"size" argument must not be negative')}function l(t,e){if(h(e),t=a(t,e<0?0:0|g(e)),!u.TYPED_ARRAY_SUPPORT)for(var r=0;r<e;++r)t[r]=0;return t}function f(t,e){var r=e.length<0?0:0|g(e.length);t=a(t,r);for(var n=0;n<r;n+=1)t[n]=255&e[n];return t}function g(t){if(t>=s())throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+s().toString(16)+" bytes");return 0|t}function d(t,e){if(u.isBuffer(t))return t.length;if("undefined"!=typeof ArrayBuffer&&"function"==typeof ArrayBuffer.isView&&(ArrayBuffer.isView(t)||t instanceof ArrayBuffer))return t.byteLength;"string"!=typeof t&&(t=""+t);var r=t.length;if(0===r)return 0;for(var n=!1;;)switch(e){case"ascii":case"latin1":case"binary":return r;case"utf8":case"utf-8":case void 0:return K(t).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return 2*r;case"hex":return r>>>1;case"base64":return q(t).length;default:if(n)return K(t).length;e=(""+e).toLowerCase(),n=!0}}function p(t,e,r){var n=!1;if((void 0===e||e<0)&&(e=0),e>this.length)return"";if((void 0===r||r>this.length)&&(r=this.length),r<=0)return"";if((r>>>=0)<=(e>>>=0))return"";for(t||(t="utf8");;)switch(t){case"hex":return I(this,e,r);case"utf8":case"utf-8":return A(this,e,r);case"ascii":return T(this,e,r);case"latin1":case"binary":return R(this,e,r);case"base64":return x(this,e,r);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return D(this,e,r);default:if(n)throw new TypeError("Unknown encoding: "+t);t=(t+"").toLowerCase(),n=!0}}function v(t,e,r){var n=t[e];t[e]=t[r],t[r]=n}function y(t,e,r,n,i){if(0===t.length)return-1;if("string"==typeof r?(n=r,r=0):r>2147483647?r=2147483647:r<-2147483648&&(r=-2147483648),r=+r,isNaN(r)&&(r=i?0:t.length-1),r<0&&(r=t.length+r),r>=t.length){if(i)return-1;r=t.length-1}else if(r<0){if(!i)return-1;r=0}if("string"==typeof e&&(e=u.from(e,n)),u.isBuffer(e))return 0===e.length?-1:m(t,e,r,n,i);if("number"==typeof e)return e&=255,u.TYPED_ARRAY_SUPPORT&&"function"==typeof Uint8Array.prototype.indexOf?i?Uint8Array.prototype.indexOf.call(t,e,r):Uint8Array.prototype.lastIndexOf.call(t,e,r):m(t,[e],r,n,i);throw new TypeError("val must be string, number or Buffer")}function m(t,e,r,n,i){var o,s=1,a=t.length,u=e.length;if(void 0!==n&&("ucs2"===(n=String(n).toLowerCase())||"ucs-2"===n||"utf16le"===n||"utf-16le"===n)){if(t.length<2||e.length<2)return-1;s=2,a/=2,u/=2,r/=2}function c(t,e){return 1===s?t[e]:t.readUInt16BE(e*s)}if(i){var h=-1;for(o=r;o<a;o++)if(c(t,o)===c(e,-1===h?0:o-h)){if(-1===h&&(h=o),o-h+1===u)return h*s}else-1!==h&&(o-=o-h),h=-1}else for(r+u>a&&(r=a-u),o=r;o>=0;o--){for(var l=!0,f=0;f<u;f++)if(c(t,o+f)!==c(e,f)){l=!1;break}if(l)return o}return-1}function _(t,e,r,n){r=Number(r)||0;var i=t.length-r;n?(n=Number(n))>i&&(n=i):n=i;var o=e.length;if(o%2!=0)throw new TypeError("Invalid hex string");n>o/2&&(n=o/2);for(var s=0;s<n;++s){var a=parseInt(e.substr(2*s,2),16);if(isNaN(a))return s;t[r+s]=a}return s}function S(t,e,r,n){return J(K(e,t.length-r),t,r,n)}function w(t,e,r,n){return J(function i(t){for(var e=[],r=0;r<t.length;++r)e.push(255&t.charCodeAt(r));return e}(e),t,r,n)}function b(t,e,r,n){return w(t,e,r,n)}function F(t,e,r,n){return J(q(e),t,r,n)}function E(t,e,r,n){return J(function i(t,e){for(var r,n,i,o=[],s=0;s<t.length&&!((e-=2)<0);++s)n=(r=t.charCodeAt(s))>>8,i=r%256,o.push(i),o.push(n);return o}(e,t.length-r),t,r,n)}function x(t,e,r){return 0===e&&r===t.length?n.fromByteArray(t):n.fromByteArray(t.slice(e,r))}function A(t,e,r){r=Math.min(t.length,r);for(var n=[],i=e;i<r;){var o,s,a,u,c=t[i],h=null,l=c>239?4:c>223?3:c>191?2:1;if(i+l<=r)switch(l){case 1:c<128&&(h=c);break;case 2:128==(192&(o=t[i+1]))&&(u=(31&c)<<6|63&o)>127&&(h=u);break;case 3:o=t[i+1],s=t[i+2],128==(192&o)&&128==(192&s)&&(u=(15&c)<<12|(63&o)<<6|63&s)>2047&&(u<55296||u>57343)&&(h=u);break;case 4:o=t[i+1],s=t[i+2],a=t[i+3],128==(192&o)&&128==(192&s)&&128==(192&a)&&(u=(15&c)<<18|(63&o)<<12|(63&s)<<6|63&a)>65535&&u<1114112&&(h=u)}null===h?(h=65533,l=1):h>65535&&(h-=65536,n.push(h>>>10&1023|55296),h=56320|1023&h),n.push(h),i+=l}return function f(t){var e=t.length;if(e<=C)return String.fromCharCode.apply(String,t);var r="",n=0;for(;n<e;)r+=String.fromCharCode.apply(String,t.slice(n,n+=C));return r}(n)}e.Buffer=u,e.SlowBuffer=function k(t){+t!=t&&(t=0);return u.alloc(+t)},e.INSPECT_MAX_BYTES=50,u.TYPED_ARRAY_SUPPORT=void 0!==t.TYPED_ARRAY_SUPPORT?t.TYPED_ARRAY_SUPPORT:function P(){try{var t=new Uint8Array(1);return t.__proto__={__proto__:Uint8Array.prototype,foo:function(){return 42}},42===t.foo()&&"function"==typeof t.subarray&&0===t.subarray(1,1).byteLength}catch(t){return!1}}(),e.kMaxLength=s(),u.poolSize=8192,u._augment=function(t){return t.__proto__=u.prototype,t},u.from=function(t,e,r){return c(null,t,e,r)},u.TYPED_ARRAY_SUPPORT&&(u.prototype.__proto__=Uint8Array.prototype,u.__proto__=Uint8Array,"undefined"!=typeof Symbol&&Symbol.species&&u[Symbol.species]===u&&Object.defineProperty(u,Symbol.species,{value:null,configurable:!0})),u.alloc=function(t,e,r){return function n(t,e,r,i){return h(e),e<=0?a(t,e):void 0!==r?"string"==typeof i?a(t,e).fill(r,i):a(t,e).fill(r):a(t,e)}(null,t,e,r)},u.allocUnsafe=function(t){return l(null,t)},u.allocUnsafeSlow=function(t){return l(null,t)},u.isBuffer=function t(e){return!(null==e||!e._isBuffer)},u.compare=function t(e,r){if(!u.isBuffer(e)||!u.isBuffer(r))throw new TypeError("Arguments must be Buffers");if(e===r)return 0;for(var n=e.length,i=r.length,o=0,s=Math.min(n,i);o<s;++o)if(e[o]!==r[o]){n=e[o],i=r[o];break}return n<i?-1:i<n?1:0},u.isEncoding=function t(e){switch(String(e).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"latin1":case"binary":case"base64":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},u.concat=function t(e,r){if(!o(e))throw new TypeError('"list" argument must be an Array of Buffers');if(0===e.length)return u.alloc(0);var n;if(void 0===r)for(r=0,n=0;n<e.length;++n)r+=e[n].length;var i=u.allocUnsafe(r),s=0;for(n=0;n<e.length;++n){var a=e[n];if(!u.isBuffer(a))throw new TypeError('"list" argument must be an Array of Buffers');a.copy(i,s),s+=a.length}return i},u.byteLength=d,u.prototype._isBuffer=!0,u.prototype.swap16=function t(){var e=this.length;if(e%2!=0)throw new RangeError("Buffer size must be a multiple of 16-bits");for(var r=0;r<e;r+=2)v(this,r,r+1);return this},u.prototype.swap32=function t(){var e=this.length;if(e%4!=0)throw new RangeError("Buffer size must be a multiple of 32-bits");for(var r=0;r<e;r+=4)v(this,r,r+3),v(this,r+1,r+2);return this},u.prototype.swap64=function t(){var e=this.length;if(e%8!=0)throw new RangeError("Buffer size must be a multiple of 64-bits");for(var r=0;r<e;r+=8)v(this,r,r+7),v(this,r+1,r+6),v(this,r+2,r+5),v(this,r+3,r+4);return this},u.prototype.toString=function t(){var e=0|this.length;return 0===e?"":0===arguments.length?A(this,0,e):p.apply(this,arguments)},u.prototype.equals=function t(e){if(!u.isBuffer(e))throw new TypeError("Argument must be a Buffer");return this===e||0===u.compare(this,e)},u.prototype.inspect=function t(){var r="",n=e.INSPECT_MAX_BYTES;return this.length>0&&(r=this.toString("hex",0,n).match(/.{2}/g).join(" "),this.length>n&&(r+=" ... ")),"<Buffer "+r+">"},u.prototype.compare=function t(e,r,n,i,o){if(!u.isBuffer(e))throw new TypeError("Argument must be a Buffer");if(void 0===r&&(r=0),void 0===n&&(n=e?e.length:0),void 0===i&&(i=0),void 0===o&&(o=this.length),r<0||n>e.length||i<0||o>this.length)throw new RangeError("out of range index");if(i>=o&&r>=n)return 0;if(i>=o)return-1;if(r>=n)return 1;if(this===e)return 0;for(var s=(o>>>=0)-(i>>>=0),a=(n>>>=0)-(r>>>=0),c=Math.min(s,a),h=this.slice(i,o),l=e.slice(r,n),f=0;f<c;++f)if(h[f]!==l[f]){s=h[f],a=l[f];break}return s<a?-1:a<s?1:0},u.prototype.includes=function t(e,r,n){return-1!==this.indexOf(e,r,n)},u.prototype.indexOf=function t(e,r,n){return y(this,e,r,n,!0)},u.prototype.lastIndexOf=function t(e,r,n){return y(this,e,r,n,!1)},u.prototype.write=function t(e,r,n,i){if(void 0===r)i="utf8",n=this.length,r=0;else if(void 0===n&&"string"==typeof r)i=r,n=this.length,r=0;else{if(!isFinite(r))throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");r|=0,isFinite(n)?(n|=0,void 0===i&&(i="utf8")):(i=n,n=void 0)}var o=this.length-r;if((void 0===n||n>o)&&(n=o),e.length>0&&(n<0||r<0)||r>this.length)throw new RangeError("Attempt to write outside buffer bounds");i||(i="utf8");for(var s=!1;;)switch(i){case"hex":return _(this,e,r,n);case"utf8":case"utf-8":return S(this,e,r,n);case"ascii":return w(this,e,r,n);case"latin1":case"binary":return b(this,e,r,n);case"base64":return F(this,e,r,n);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return E(this,e,r,n);default:if(s)throw new TypeError("Unknown encoding: "+i);i=(""+i).toLowerCase(),s=!0}},u.prototype.toJSON=function t(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};var C=4096;function T(t,e,r){var n="";r=Math.min(t.length,r);for(var i=e;i<r;++i)n+=String.fromCharCode(127&t[i]);return n}function R(t,e,r){var n="";r=Math.min(t.length,r);for(var i=e;i<r;++i)n+=String.fromCharCode(t[i]);return n}function I(t,e,r){var n=t.length;(!e||e<0)&&(e=0),(!r||r<0||r>n)&&(r=n);for(var i="",o=e;o<r;++o)i+=V(t[o]);return i}function D(t,e,r){for(var n=t.slice(e,r),i="",o=0;o<n.length;o+=2)i+=String.fromCharCode(n[o]+256*n[o+1]);return i}function N(t,e,r){if(t%1!=0||t<0)throw new RangeError("offset is not uint");if(t+e>r)throw new RangeError("Trying to access beyond buffer length")}function L(t,e,r,n,i,o){if(!u.isBuffer(t))throw new TypeError('"buffer" argument must be a Buffer instance');if(e>i||e<o)throw new RangeError('"value" argument is out of bounds');if(r+n>t.length)throw new RangeError("Index out of range")}function U(t,e,r,n){e<0&&(e=65535+e+1);for(var i=0,o=Math.min(t.length-r,2);i<o;++i)t[r+i]=(e&255<<8*(n?i:1-i))>>>8*(n?i:1-i)}function B(t,e,r,n){e<0&&(e=4294967295+e+1);for(var i=0,o=Math.min(t.length-r,4);i<o;++i)t[r+i]=e>>>8*(n?i:3-i)&255}function O(t,e,r,n,i,o){if(r+n>t.length)throw new RangeError("Index out of range");if(r<0)throw new RangeError("Index out of range")}function j(t,e,r,n,o){return o||O(t,0,r,4),i.write(t,e,r,n,23,4),r+4}function M(t,e,r,n,o){return o||O(t,0,r,8),i.write(t,e,r,n,52,8),r+8}u.prototype.slice=function t(e,r){var n,i=this.length;if((e=~~e)<0?(e+=i)<0&&(e=0):e>i&&(e=i),(r=void 0===r?i:~~r)<0?(r+=i)<0&&(r=0):r>i&&(r=i),r<e&&(r=e),u.TYPED_ARRAY_SUPPORT)(n=this.subarray(e,r)).__proto__=u.prototype;else{var o=r-e;n=new u(o,void 0);for(var s=0;s<o;++s)n[s]=this[s+e]}return n},u.prototype.readUIntLE=function t(e,r,n){e|=0,r|=0,n||N(e,r,this.length);for(var i=this[e],o=1,s=0;++s<r&&(o*=256);)i+=this[e+s]*o;return i},u.prototype.readUIntBE=function t(e,r,n){e|=0,r|=0,n||N(e,r,this.length);for(var i=this[e+--r],o=1;r>0&&(o*=256);)i+=this[e+--r]*o;return i},u.prototype.readUInt8=function t(e,r){return r||N(e,1,this.length),this[e]},u.prototype.readUInt16LE=function t(e,r){return r||N(e,2,this.length),this[e]|this[e+1]<<8},u.prototype.readUInt16BE=function t(e,r){return r||N(e,2,this.length),this[e]<<8|this[e+1]},u.prototype.readUInt32LE=function t(e,r){return r||N(e,4,this.length),(this[e]|this[e+1]<<8|this[e+2]<<16)+16777216*this[e+3]},u.prototype.readUInt32BE=function t(e,r){return r||N(e,4,this.length),16777216*this[e]+(this[e+1]<<16|this[e+2]<<8|this[e+3])},u.prototype.readIntLE=function t(e,r,n){e|=0,r|=0,n||N(e,r,this.length);for(var i=this[e],o=1,s=0;++s<r&&(o*=256);)i+=this[e+s]*o;return i>=(o*=128)&&(i-=Math.pow(2,8*r)),i},u.prototype.readIntBE=function t(e,r,n){e|=0,r|=0,n||N(e,r,this.length);for(var i=r,o=1,s=this[e+--i];i>0&&(o*=256);)s+=this[e+--i]*o;return s>=(o*=128)&&(s-=Math.pow(2,8*r)),s},u.prototype.readInt8=function t(e,r){return r||N(e,1,this.length),128&this[e]?-1*(255-this[e]+1):this[e]},u.prototype.readInt16LE=function t(e,r){r||N(e,2,this.length);var n=this[e]|this[e+1]<<8;return 32768&n?4294901760|n:n},u.prototype.readInt16BE=function t(e,r){r||N(e,2,this.length);var n=this[e+1]|this[e]<<8;return 32768&n?4294901760|n:n},u.prototype.readInt32LE=function t(e,r){return r||N(e,4,this.length),this[e]|this[e+1]<<8|this[e+2]<<16|this[e+3]<<24},u.prototype.readInt32BE=function t(e,r){return r||N(e,4,this.length),this[e]<<24|this[e+1]<<16|this[e+2]<<8|this[e+3]},u.prototype.readFloatLE=function t(e,r){return r||N(e,4,this.length),i.read(this,e,!0,23,4)},u.prototype.readFloatBE=function t(e,r){return r||N(e,4,this.length),i.read(this,e,!1,23,4)},u.prototype.readDoubleLE=function t(e,r){return r||N(e,8,this.length),i.read(this,e,!0,52,8)},u.prototype.readDoubleBE=function t(e,r){return r||N(e,8,this.length),i.read(this,e,!1,52,8)},u.prototype.writeUIntLE=function t(e,r,n,i){(e=+e,r|=0,n|=0,i)||L(this,e,r,n,Math.pow(2,8*n)-1,0);var o=1,s=0;for(this[r]=255&e;++s<n&&(o*=256);)this[r+s]=e/o&255;return r+n},u.prototype.writeUIntBE=function t(e,r,n,i){(e=+e,r|=0,n|=0,i)||L(this,e,r,n,Math.pow(2,8*n)-1,0);var o=n-1,s=1;for(this[r+o]=255&e;--o>=0&&(s*=256);)this[r+o]=e/s&255;return r+n},u.prototype.writeUInt8=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,1,255,0),u.TYPED_ARRAY_SUPPORT||(e=Math.floor(e)),this[r]=255&e,r+1},u.prototype.writeUInt16LE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,2,65535,0),u.TYPED_ARRAY_SUPPORT?(this[r]=255&e,this[r+1]=e>>>8):U(this,e,r,!0),r+2},u.prototype.writeUInt16BE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,2,65535,0),u.TYPED_ARRAY_SUPPORT?(this[r]=e>>>8,this[r+1]=255&e):U(this,e,r,!1),r+2},u.prototype.writeUInt32LE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,4,4294967295,0),u.TYPED_ARRAY_SUPPORT?(this[r+3]=e>>>24,this[r+2]=e>>>16,this[r+1]=e>>>8,this[r]=255&e):B(this,e,r,!0),r+4},u.prototype.writeUInt32BE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,4,4294967295,0),u.TYPED_ARRAY_SUPPORT?(this[r]=e>>>24,this[r+1]=e>>>16,this[r+2]=e>>>8,this[r+3]=255&e):B(this,e,r,!1),r+4},u.prototype.writeIntLE=function t(e,r,n,i){if(e=+e,r|=0,!i){var o=Math.pow(2,8*n-1);L(this,e,r,n,o-1,-o)}var s=0,a=1,u=0;for(this[r]=255&e;++s<n&&(a*=256);)e<0&&0===u&&0!==this[r+s-1]&&(u=1),this[r+s]=(e/a>>0)-u&255;return r+n},u.prototype.writeIntBE=function t(e,r,n,i){if(e=+e,r|=0,!i){var o=Math.pow(2,8*n-1);L(this,e,r,n,o-1,-o)}var s=n-1,a=1,u=0;for(this[r+s]=255&e;--s>=0&&(a*=256);)e<0&&0===u&&0!==this[r+s+1]&&(u=1),this[r+s]=(e/a>>0)-u&255;return r+n},u.prototype.writeInt8=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,1,127,-128),u.TYPED_ARRAY_SUPPORT||(e=Math.floor(e)),e<0&&(e=255+e+1),this[r]=255&e,r+1},u.prototype.writeInt16LE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,2,32767,-32768),u.TYPED_ARRAY_SUPPORT?(this[r]=255&e,this[r+1]=e>>>8):U(this,e,r,!0),r+2},u.prototype.writeInt16BE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,2,32767,-32768),u.TYPED_ARRAY_SUPPORT?(this[r]=e>>>8,this[r+1]=255&e):U(this,e,r,!1),r+2},u.prototype.writeInt32LE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,4,2147483647,-2147483648),u.TYPED_ARRAY_SUPPORT?(this[r]=255&e,this[r+1]=e>>>8,this[r+2]=e>>>16,this[r+3]=e>>>24):B(this,e,r,!0),r+4},u.prototype.writeInt32BE=function t(e,r,n){return e=+e,r|=0,n||L(this,e,r,4,2147483647,-2147483648),e<0&&(e=4294967295+e+1),u.TYPED_ARRAY_SUPPORT?(this[r]=e>>>24,this[r+1]=e>>>16,this[r+2]=e>>>8,this[r+3]=255&e):B(this,e,r,!1),r+4},u.prototype.writeFloatLE=function t(e,r,n){return j(this,e,r,!0,n)},u.prototype.writeFloatBE=function t(e,r,n){return j(this,e,r,!1,n)},u.prototype.writeDoubleLE=function t(e,r,n){return M(this,e,r,!0,n)},u.prototype.writeDoubleBE=function t(e,r,n){return M(this,e,r,!1,n)},u.prototype.copy=function t(e,r,n,i){if(n||(n=0),i||0===i||(i=this.length),r>=e.length&&(r=e.length),r||(r=0),i>0&&i<n&&(i=n),i===n)return 0;if(0===e.length||0===this.length)return 0;if(r<0)throw new RangeError("targetStart out of bounds");if(n<0||n>=this.length)throw new RangeError("sourceStart out of bounds");if(i<0)throw new RangeError("sourceEnd out of bounds");i>this.length&&(i=this.length),e.length-r<i-n&&(i=e.length-r+n);var o,s=i-n;if(this===e&&n<r&&r<i)for(o=s-1;o>=0;--o)e[o+r]=this[o+n];else if(s<1e3||!u.TYPED_ARRAY_SUPPORT)for(o=0;o<s;++o)e[o+r]=this[o+n];else Uint8Array.prototype.set.call(e,this.subarray(n,n+s),r);return s},u.prototype.fill=function t(e,r,n,i){if("string"==typeof e){if("string"==typeof r?(i=r,r=0,n=this.length):"string"==typeof n&&(i=n,n=this.length),1===e.length){var o=e.charCodeAt(0);o<256&&(e=o)}if(void 0!==i&&"string"!=typeof i)throw new TypeError("encoding must be a string");if("string"==typeof i&&!u.isEncoding(i))throw new TypeError("Unknown encoding: "+i)}else"number"==typeof e&&(e&=255);if(r<0||this.length<r||this.length<n)throw new RangeError("Out of range index");if(n<=r)return this;var s;if(r>>>=0,n=void 0===n?this.length:n>>>0,e||(e=0),"number"==typeof e)for(s=r;s<n;++s)this[s]=e;else{var a=u.isBuffer(e)?e:K(new u(e,i).toString()),c=a.length;for(s=0;s<n-r;++s)this[s+r]=a[s%c]}return this};var H=/[^+\/0-9A-Za-z-_]/g;function V(t){return t<16?"0"+t.toString(16):t.toString(16)}function K(t,e){var r;e=e||1/0;for(var n=t.length,i=null,o=[],s=0;s<n;++s){if((r=t.charCodeAt(s))>55295&&r<57344){if(!i){if(r>56319){(e-=3)>-1&&o.push(239,191,189);continue}if(s+1===n){(e-=3)>-1&&o.push(239,191,189);continue}i=r;continue}if(r<56320){(e-=3)>-1&&o.push(239,191,189),i=r;continue}r=65536+(i-55296<<10|r-56320)}else i&&(e-=3)>-1&&o.push(239,191,189);if(i=null,r<128){if((e-=1)<0)break;o.push(r)}else if(r<2048){if((e-=2)<0)break;o.push(r>>6|192,63&r|128)}else if(r<65536){if((e-=3)<0)break;o.push(r>>12|224,r>>6&63|128,63&r|128)}else{if(!(r<1114112))throw new Error("Invalid code point");if((e-=4)<0)break;o.push(r>>18|240,r>>12&63|128,r>>6&63|128,63&r|128)}}return o}function q(t){return n.toByteArray(function e(t){if((t=function e(t){return t.trim?t.trim():t.replace(/^\s+|\s+$/g,"")}(t).replace(H,"")).length<2)return"";for(;t.length%4!=0;)t+="=";return t}(t))}function J(t,e,r,n){for(var i=0;i<n&&!(i+r>=e.length||i>=t.length);++i)e[i+r]=t[i];return i}}).call(this,r(29))},function(t,e){var r;r=function(){return this}();try{r=r||new Function("return this")()}catch(t){"object"==typeof window&&(r=window)}t.exports=r},function(t,e,r){"use strict";e.byteLength=function n(t){var e=f(t),r=e[0],n=e[1];return 3*(r+n)/4-n},e.toByteArray=function i(t){var e,r,n=f(t),i=n[0],o=n[1],s=new u(function c(t,e,r){return 3*(e+r)/4-r}(0,i,o)),h=0,l=o>0?i-4:i;for(r=0;r<l;r+=4)e=a[t.charCodeAt(r)]<<18|a[t.charCodeAt(r+1)]<<12|a[t.charCodeAt(r+2)]<<6|a[t.charCodeAt(r+3)],s[h++]=e>>16&255,s[h++]=e>>8&255,s[h++]=255&e;2===o&&(e=a[t.charCodeAt(r)]<<2|a[t.charCodeAt(r+1)]>>4,s[h++]=255&e);1===o&&(e=a[t.charCodeAt(r)]<<10|a[t.charCodeAt(r+1)]<<4|a[t.charCodeAt(r+2)]>>2,s[h++]=e>>8&255,s[h++]=255&e);return s},e.fromByteArray=function o(t){for(var e,r=t.length,n=r%3,i=[],o=16383,a=0,u=r-n;a<u;a+=o)i.push(g(t,a,a+o>u?u:a+o));1===n?(e=t[r-1],i.push(s[e>>2]+s[e<<4&63]+"==")):2===n&&(e=(t[r-2]<<8)+t[r-1],i.push(s[e>>10]+s[e>>4&63]+s[e<<2&63]+"="));return i.join("")};for(var s=[],a=[],u="undefined"!=typeof Uint8Array?Uint8Array:Array,c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",h=0,l=c.length;h<l;++h)s[h]=c[h],a[c.charCodeAt(h)]=h;function f(t){var e=t.length;if(e%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var r=t.indexOf("=");return-1===r&&(r=e),[r,r===e?0:4-r%4]}function g(t,e,r){for(var n,i,o=[],a=e;a<r;a+=3)n=(t[a]<<16&16711680)+(t[a+1]<<8&65280)+(255&t[a+2]),o.push(s[(i=n)>>18&63]+s[i>>12&63]+s[i>>6&63]+s[63&i]);return o.join("")}a["-".charCodeAt(0)]=62,a["_".charCodeAt(0)]=63},function(t,e){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
e.read=function(t,e,r,n,i){var o,s,a=8*i-n-1,u=(1<<a)-1,c=u>>1,h=-7,l=r?i-1:0,f=r?-1:1,g=t[e+l];for(l+=f,o=g&(1<<-h)-1,g>>=-h,h+=a;h>0;o=256*o+t[e+l],l+=f,h-=8);for(s=o&(1<<-h)-1,o>>=-h,h+=n;h>0;s=256*s+t[e+l],l+=f,h-=8);if(0===o)o=1-c;else{if(o===u)return s?NaN:1/0*(g?-1:1);s+=Math.pow(2,n),o-=c}return(g?-1:1)*s*Math.pow(2,o-n)},e.write=function(t,e,r,n,i,o){var s,a,u,c=8*o-i-1,h=(1<<c)-1,l=h>>1,f=23===i?Math.pow(2,-24)-Math.pow(2,-77):0,g=n?0:o-1,d=n?1:-1,p=e<0||0===e&&1/e<0?1:0;for(e=Math.abs(e),isNaN(e)||e===1/0?(a=isNaN(e)?1:0,s=h):(s=Math.floor(Math.log(e)/Math.LN2),e*(u=Math.pow(2,-s))<1&&(s--,u*=2),(e+=s+l>=1?f/u:f*Math.pow(2,1-l))*u>=2&&(s++,u/=2),s+l>=h?(a=0,s=h):s+l>=1?(a=(e*u-1)*Math.pow(2,i),s+=l):(a=e*Math.pow(2,l-1)*Math.pow(2,i),s=0));i>=8;t[r+g]=255&a,g+=d,a/=256,i-=8);for(s=s<<i|a,c+=i;c>0;t[r+g]=255&s,g+=d,s/=256,c-=8);t[r+g-d]|=128*p}},function(t,e){var r={}.toString;t.exports=Array.isArray||function(t){return"[object Array]"==r.call(t)}},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.default=function n(t){var e=t.jws,r=t.KeyUtil,n=t.X509,o=t.crypto,s=t.hextob64u,a=t.b64tohex,u=t.AllowedSigningAlgs;return function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.parseJwt=function t(r){i.Log.debug("JoseUtil.parseJwt");try{var n=e.JWS.parse(r);return{header:n.headerObj,payload:n.payloadObj}}catch(t){i.Log.error(t)}},t.validateJwt=function e(o,s,u,c,h,l,f){i.Log.debug("JoseUtil.validateJwt");try{if("RSA"===s.kty)if(s.e&&s.n)s=r.getKey(s);else{if(!s.x5c||!s.x5c.length)return i.Log.error("JoseUtil.validateJwt: RSA key missing key material",s),Promise.reject(new Error("RSA key missing key material"));var g=a(s.x5c[0]);s=n.getPublicKeyFromCertHex(g)}else{if("EC"!==s.kty)return i.Log.error("JoseUtil.validateJwt: Unsupported key type",s&&s.kty),Promise.reject(new Error(s.kty));if(!(s.crv&&s.x&&s.y))return i.Log.error("JoseUtil.validateJwt: EC key missing key material",s),Promise.reject(new Error("EC key missing key material"));s=r.getKey(s)}return t._validateJwt(o,s,u,c,h,l,f)}catch(t){return i.Log.error(t&&t.message||t),Promise.reject("JWT validation failed")}},t.validateJwtAttributes=function e(r,n,o,s,a,u){s||(s=0),a||(a=parseInt(Date.now()/1e3));var c=t.parseJwt(r).payload;if(!c.iss)return i.Log.error("JoseUtil._validateJwt: issuer was not provided"),Promise.reject(new Error("issuer was not provided"));if(c.iss!==n)return i.Log.error("JoseUtil._validateJwt: Invalid issuer in token",c.iss),Promise.reject(new Error("Invalid issuer in token: "+c.iss));if(!c.aud)return i.Log.error("JoseUtil._validateJwt: aud was not provided"),Promise.reject(new Error("aud was not provided"));if(!(c.aud===o||Array.isArray(c.aud)&&c.aud.indexOf(o)>=0))return i.Log.error("JoseUtil._validateJwt: Invalid audience in token",c.aud),Promise.reject(new Error("Invalid audience in token: "+c.aud));if(c.azp&&c.azp!==o)return i.Log.error("JoseUtil._validateJwt: Invalid azp in token",c.azp),Promise.reject(new Error("Invalid azp in token: "+c.azp));if(!u){var h=a+s,l=a-s;if(!c.iat)return i.Log.error("JoseUtil._validateJwt: iat was not provided"),Promise.reject(new Error("iat was not provided"));if(h<c.iat)return i.Log.error("JoseUtil._validateJwt: iat is in the future",c.iat),Promise.reject(new Error("iat is in the future: "+c.iat));if(c.nbf&&h<c.nbf)return i.Log.error("JoseUtil._validateJwt: nbf is in the future",c.nbf),Promise.reject(new Error("nbf is in the future: "+c.nbf));if(!c.exp)return i.Log.error("JoseUtil._validateJwt: exp was not provided"),Promise.reject(new Error("exp was not provided"));if(c.exp<l)return i.Log.error("JoseUtil._validateJwt: exp is in the past",c.exp),Promise.reject(new Error("exp is in the past:"+c.exp))}return Promise.resolve(c)},t._validateJwt=function r(n,o,s,a,c,h,l){return t.validateJwtAttributes(n,s,a,c,h,l).then((function(t){try{return e.JWS.verify(n,o,u)?t:(i.Log.error("JoseUtil._validateJwt: signature validation failed"),Promise.reject(new Error("signature validation failed")))}catch(t){return i.Log.error(t&&t.message||t),Promise.reject(new Error("signature validation failed"))}}))},t.hashString=function t(e,r){try{return o.Util.hashString(e,r)}catch(t){i.Log.error(t)}},t.hexToBase64Url=function t(e){try{return s(e)}catch(t){i.Log.error(t)}},t}()};var i=r(0);t.exports=e.default},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SigninResponse=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(3);function o(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}e.SigninResponse=function(){function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"#";o(this,t);var n=i.UrlUtility.parseUrlFragment(e,r);this.error=n.error,this.error_description=n.error_description,this.error_uri=n.error_uri,this.code=n.code,this.state=n.state,this.id_token=n.id_token,this.session_state=n.session_state,this.access_token=n.access_token,this.token_type=n.token_type,this.scope=n.scope,this.profile=void 0,this.expires_in=n.expires_in}return n(t,[{key:"expires_in",get:function t(){if(this.expires_at){var e=parseInt(Date.now()/1e3);return this.expires_at-e}},set:function t(e){var r=parseInt(e);if("number"==typeof r&&r>0){var n=parseInt(Date.now()/1e3);this.expires_at=n+r}}},{key:"expired",get:function t(){var e=this.expires_in;if(void 0!==e)return e<=0}},{key:"scopes",get:function t(){return(this.scope||"").split(" ")}},{key:"isOpenIdConnect",get:function t(){return this.scopes.indexOf("openid")>=0||!!this.id_token}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SignoutRequest=void 0;var n=r(0),i=r(3),o=r(9);e.SignoutRequest=function t(e){var r=e.url,s=e.id_token_hint,a=e.post_logout_redirect_uri,u=e.data,c=e.extraQueryParams,h=e.request_type;if(function l(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),!r)throw n.Log.error("SignoutRequest.ctor: No url passed"),new Error("url");for(var f in s&&(r=i.UrlUtility.addQueryParam(r,"id_token_hint",s)),a&&(r=i.UrlUtility.addQueryParam(r,"post_logout_redirect_uri",a),u&&(this.state=new o.State({data:u,request_type:h}),r=i.UrlUtility.addQueryParam(r,"state",this.state.id))),c)r=i.UrlUtility.addQueryParam(r,f,c[f]);this.url=r}},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SignoutResponse=void 0;var n=r(3);e.SignoutResponse=function t(e){!function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t);var i=n.UrlUtility.parseUrlFragment(e,"?");this.error=i.error,this.error_description=i.error_description,this.error_uri=i.error_uri,this.state=i.state}},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.InMemoryWebStorage=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0);e.InMemoryWebStorage=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t),this._data={}}return t.prototype.getItem=function t(e){return i.Log.debug("InMemoryWebStorage.getItem",e),this._data[e]},t.prototype.setItem=function t(e,r){i.Log.debug("InMemoryWebStorage.setItem",e),this._data[e]=r},t.prototype.removeItem=function t(e){i.Log.debug("InMemoryWebStorage.removeItem",e),delete this._data[e]},t.prototype.key=function t(e){return Object.getOwnPropertyNames(this._data)[e]},n(t,[{key:"length",get:function t(){return Object.getOwnPropertyNames(this._data).length}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.UserManager=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(10),s=r(39),a=r(15),u=r(45),c=r(47),h=r(18),l=r(8),f=r(20),g=r(11),d=r(4);function p(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function v(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}e.UserManager=function(t){function e(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:c.SilentRenewService,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:h.SessionMonitor,a=arguments.length>3&&void 0!==arguments[3]?arguments[3]:f.TokenRevocationClient,l=arguments.length>4&&void 0!==arguments[4]?arguments[4]:g.TokenClient,y=arguments.length>5&&void 0!==arguments[5]?arguments[5]:d.JoseUtil;p(this,e),r instanceof s.UserManagerSettings||(r=new s.UserManagerSettings(r));var m=v(this,t.call(this,r));return m._events=new u.UserManagerEvents(r),m._silentRenewService=new n(m),m.settings.automaticSilentRenew&&(i.Log.debug("UserManager.ctor: automaticSilentRenew is configured, setting up silent renew"),m.startSilentRenew()),m.settings.monitorSession&&(i.Log.debug("UserManager.ctor: monitorSession is configured, setting up session monitor"),m._sessionMonitor=new o(m)),m._tokenRevocationClient=new a(m._settings),m._tokenClient=new l(m._settings),m._joseUtil=y,m}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),e.prototype.getUser=function t(){var e=this;return this._loadUser().then((function(t){return t?(i.Log.info("UserManager.getUser: user loaded"),e._events.load(t,!1),t):(i.Log.info("UserManager.getUser: user not found in storage"),null)}))},e.prototype.removeUser=function t(){var e=this;return this.storeUser(null).then((function(){i.Log.info("UserManager.removeUser: user removed from storage"),e._events.unload()}))},e.prototype.signinRedirect=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(e=Object.assign({},e)).request_type="si:r";var r={useReplaceToNavigate:e.useReplaceToNavigate};return this._signinStart(e,this._redirectNavigator,r).then((function(){i.Log.info("UserManager.signinRedirect: successful")}))},e.prototype.signinRedirectCallback=function t(e){return this._signinEnd(e||this._redirectNavigator.url).then((function(t){return t.profile&&t.profile.sub?i.Log.info("UserManager.signinRedirectCallback: successful, signed in sub: ",t.profile.sub):i.Log.info("UserManager.signinRedirectCallback: no sub"),t}))},e.prototype.signinPopup=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(e=Object.assign({},e)).request_type="si:p";var r=e.redirect_uri||this.settings.popup_redirect_uri||this.settings.redirect_uri;return r?(e.redirect_uri=r,e.display="popup",this._signin(e,this._popupNavigator,{startUrl:r,popupWindowFeatures:e.popupWindowFeatures||this.settings.popupWindowFeatures,popupWindowTarget:e.popupWindowTarget||this.settings.popupWindowTarget}).then((function(t){return t&&(t.profile&&t.profile.sub?i.Log.info("UserManager.signinPopup: signinPopup successful, signed in sub: ",t.profile.sub):i.Log.info("UserManager.signinPopup: no sub")),t}))):(i.Log.error("UserManager.signinPopup: No popup_redirect_uri or redirect_uri configured"),Promise.reject(new Error("No popup_redirect_uri or redirect_uri configured")))},e.prototype.signinPopupCallback=function t(e){return this._signinCallback(e,this._popupNavigator).then((function(t){return t&&(t.profile&&t.profile.sub?i.Log.info("UserManager.signinPopupCallback: successful, signed in sub: ",t.profile.sub):i.Log.info("UserManager.signinPopupCallback: no sub")),t})).catch((function(t){i.Log.error(t.message)}))},e.prototype.signinSilent=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return r=Object.assign({},r),this._loadUser().then((function(t){return t&&t.refresh_token?(r.refresh_token=t.refresh_token,e._useRefreshToken(r)):(r.request_type="si:s",r.id_token_hint=r.id_token_hint||e.settings.includeIdTokenInSilentRenew&&t&&t.id_token,t&&e._settings.validateSubOnSilentRenew&&(i.Log.debug("UserManager.signinSilent, subject prior to silent renew: ",t.profile.sub),r.current_sub=t.profile.sub),e._signinSilentIframe(r))}))},e.prototype._useRefreshToken=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return this._tokenClient.exchangeRefreshToken(r).then((function(t){return t?t.access_token?e._loadUser().then((function(r){if(r){var n=Promise.resolve();return t.id_token&&(n=e._validateIdTokenFromTokenRefreshToken(r.profile,t.id_token)),n.then((function(){return i.Log.debug("UserManager._useRefreshToken: refresh token response success"),r.id_token=t.id_token||r.id_token,r.access_token=t.access_token,r.refresh_token=t.refresh_token||r.refresh_token,r.expires_in=t.expires_in,e.storeUser(r).then((function(){return e._events.load(r),r}))}))}return null})):(i.Log.error("UserManager._useRefreshToken: No access token returned from token endpoint"),Promise.reject("No access token returned from token endpoint")):(i.Log.error("UserManager._useRefreshToken: No response returned from token endpoint"),Promise.reject("No response returned from token endpoint"))}))},e.prototype._validateIdTokenFromTokenRefreshToken=function t(e,r){var n=this;return this._metadataService.getIssuer().then((function(t){return n.settings.getEpochTime().then((function(o){return n._joseUtil.validateJwtAttributes(r,t,n._settings.client_id,n._settings.clockSkew,o).then((function(t){return t?t.sub!==e.sub?(i.Log.error("UserManager._validateIdTokenFromTokenRefreshToken: sub in id_token does not match current sub"),Promise.reject(new Error("sub in id_token does not match current sub"))):t.auth_time&&t.auth_time!==e.auth_time?(i.Log.error("UserManager._validateIdTokenFromTokenRefreshToken: auth_time in id_token does not match original auth_time"),Promise.reject(new Error("auth_time in id_token does not match original auth_time"))):t.azp&&t.azp!==e.azp?(i.Log.error("UserManager._validateIdTokenFromTokenRefreshToken: azp in id_token does not match original azp"),Promise.reject(new Error("azp in id_token does not match original azp"))):!t.azp&&e.azp?(i.Log.error("UserManager._validateIdTokenFromTokenRefreshToken: azp not in id_token, but present in original id_token"),Promise.reject(new Error("azp not in id_token, but present in original id_token"))):void 0:(i.Log.error("UserManager._validateIdTokenFromTokenRefreshToken: Failed to validate id_token"),Promise.reject(new Error("Failed to validate id_token")))}))}))}))},e.prototype._signinSilentIframe=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=e.redirect_uri||this.settings.silent_redirect_uri||this.settings.redirect_uri;return r?(e.redirect_uri=r,e.prompt=e.prompt||"none",this._signin(e,this._iframeNavigator,{startUrl:r,silentRequestTimeout:e.silentRequestTimeout||this.settings.silentRequestTimeout}).then((function(t){return t&&(t.profile&&t.profile.sub?i.Log.info("UserManager.signinSilent: successful, signed in sub: ",t.profile.sub):i.Log.info("UserManager.signinSilent: no sub")),t}))):(i.Log.error("UserManager.signinSilent: No silent_redirect_uri configured"),Promise.reject(new Error("No silent_redirect_uri configured")))},e.prototype.signinSilentCallback=function t(e){return this._signinCallback(e,this._iframeNavigator).then((function(t){return t&&(t.profile&&t.profile.sub?i.Log.info("UserManager.signinSilentCallback: successful, signed in sub: ",t.profile.sub):i.Log.info("UserManager.signinSilentCallback: no sub")),t}))},e.prototype.signinCallback=function t(e){var r=this;return this.readSigninResponseState(e).then((function(t){var n=t.state;t.response;return"si:r"===n.request_type?r.signinRedirectCallback(e):"si:p"===n.request_type?r.signinPopupCallback(e):"si:s"===n.request_type?r.signinSilentCallback(e):Promise.reject(new Error("invalid response_type in state"))}))},e.prototype.signoutCallback=function t(e,r){var n=this;return this.readSignoutResponseState(e).then((function(t){var i=t.state,o=t.response;return i?"so:r"===i.request_type?n.signoutRedirectCallback(e):"so:p"===i.request_type?n.signoutPopupCallback(e,r):Promise.reject(new Error("invalid response_type in state")):o}))},e.prototype.querySessionStatus=function t(){var e=this,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(r=Object.assign({},r)).request_type="si:s";var n=r.redirect_uri||this.settings.silent_redirect_uri||this.settings.redirect_uri;return n?(r.redirect_uri=n,r.prompt="none",r.response_type=r.response_type||this.settings.query_status_response_type,r.scope=r.scope||"openid",r.skipUserInfo=!0,this._signinStart(r,this._iframeNavigator,{startUrl:n,silentRequestTimeout:r.silentRequestTimeout||this.settings.silentRequestTimeout}).then((function(t){return e.processSigninResponse(t.url).then((function(t){if(i.Log.debug("UserManager.querySessionStatus: got signin response"),t.session_state&&t.profile.sub)return i.Log.info("UserManager.querySessionStatus: querySessionStatus success for sub: ",t.profile.sub),{session_state:t.session_state,sub:t.profile.sub,sid:t.profile.sid};i.Log.info("querySessionStatus successful, user not authenticated")})).catch((function(t){if(t.session_state&&e.settings.monitorAnonymousSession&&("login_required"==t.message||"consent_required"==t.message||"interaction_required"==t.message||"account_selection_required"==t.message))return i.Log.info("UserManager.querySessionStatus: querySessionStatus success for anonymous user"),{session_state:t.session_state};throw t}))}))):(i.Log.error("UserManager.querySessionStatus: No silent_redirect_uri configured"),Promise.reject(new Error("No silent_redirect_uri configured")))},e.prototype._signin=function t(e,r){var n=this,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return this._signinStart(e,r,i).then((function(t){return n._signinEnd(t.url,e)}))},e.prototype._signinStart=function t(e,r){var n=this,o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return r.prepare(o).then((function(t){return i.Log.debug("UserManager._signinStart: got navigator window handle"),n.createSigninRequest(e).then((function(e){return i.Log.debug("UserManager._signinStart: got signin request"),o.url=e.url,o.id=e.state.id,t.navigate(o)})).catch((function(e){throw t.close&&(i.Log.debug("UserManager._signinStart: Error after preparing navigator, closing navigator window"),t.close()),e}))}))},e.prototype._signinEnd=function t(e){var r=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return this.processSigninResponse(e).then((function(t){i.Log.debug("UserManager._signinEnd: got signin response");var e=new a.User(t);if(n.current_sub){if(n.current_sub!==e.profile.sub)return i.Log.debug("UserManager._signinEnd: current user does not match user returned from signin. sub from signin: ",e.profile.sub),Promise.reject(new Error("login_required"));i.Log.debug("UserManager._signinEnd: current user matches user returned from signin")}return r.storeUser(e).then((function(){return i.Log.debug("UserManager._signinEnd: user stored"),r._events.load(e),e}))}))},e.prototype._signinCallback=function t(e,r){i.Log.debug("UserManager._signinCallback");var n="query"===this._settings.response_mode||!this._settings.response_mode&&l.SigninRequest.isCode(this._settings.response_type)?"?":"#";return r.callback(e,void 0,n)},e.prototype.signoutRedirect=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(e=Object.assign({},e)).request_type="so:r";var r=e.post_logout_redirect_uri||this.settings.post_logout_redirect_uri;r&&(e.post_logout_redirect_uri=r);var n={useReplaceToNavigate:e.useReplaceToNavigate};return this._signoutStart(e,this._redirectNavigator,n).then((function(){i.Log.info("UserManager.signoutRedirect: successful")}))},e.prototype.signoutRedirectCallback=function t(e){return this._signoutEnd(e||this._redirectNavigator.url).then((function(t){return i.Log.info("UserManager.signoutRedirectCallback: successful"),t}))},e.prototype.signoutPopup=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};(e=Object.assign({},e)).request_type="so:p";var r=e.post_logout_redirect_uri||this.settings.popup_post_logout_redirect_uri||this.settings.post_logout_redirect_uri;return e.post_logout_redirect_uri=r,e.display="popup",e.post_logout_redirect_uri&&(e.state=e.state||{}),this._signout(e,this._popupNavigator,{startUrl:r,popupWindowFeatures:e.popupWindowFeatures||this.settings.popupWindowFeatures,popupWindowTarget:e.popupWindowTarget||this.settings.popupWindowTarget}).then((function(){i.Log.info("UserManager.signoutPopup: successful")}))},e.prototype.signoutPopupCallback=function t(e,r){void 0===r&&"boolean"==typeof e&&(r=e,e=null);return this._popupNavigator.callback(e,r,"?").then((function(){i.Log.info("UserManager.signoutPopupCallback: successful")}))},e.prototype._signout=function t(e,r){var n=this,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return this._signoutStart(e,r,i).then((function(t){return n._signoutEnd(t.url)}))},e.prototype._signoutStart=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=this,n=arguments[1],o=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return n.prepare(o).then((function(t){return i.Log.debug("UserManager._signoutStart: got navigator window handle"),r._loadUser().then((function(n){return i.Log.debug("UserManager._signoutStart: loaded current user from storage"),(r._settings.revokeAccessTokenOnSignout?r._revokeInternal(n):Promise.resolve()).then((function(){var s=e.id_token_hint||n&&n.id_token;return s&&(i.Log.debug("UserManager._signoutStart: Setting id_token into signout request"),e.id_token_hint=s),r.removeUser().then((function(){return i.Log.debug("UserManager._signoutStart: user removed, creating signout request"),r.createSignoutRequest(e).then((function(e){return i.Log.debug("UserManager._signoutStart: got signout request"),o.url=e.url,e.state&&(o.id=e.state.id),t.navigate(o)}))}))}))})).catch((function(e){throw t.close&&(i.Log.debug("UserManager._signoutStart: Error after preparing navigator, closing navigator window"),t.close()),e}))}))},e.prototype._signoutEnd=function t(e){return this.processSignoutResponse(e).then((function(t){return i.Log.debug("UserManager._signoutEnd: got signout response"),t}))},e.prototype.revokeAccessToken=function t(){var e=this;return this._loadUser().then((function(t){return e._revokeInternal(t,!0).then((function(r){if(r)return i.Log.debug("UserManager.revokeAccessToken: removing token properties from user and re-storing"),t.access_token=null,t.refresh_token=null,t.expires_at=null,t.token_type=null,e.storeUser(t).then((function(){i.Log.debug("UserManager.revokeAccessToken: user stored"),e._events.load(t)}))}))})).then((function(){i.Log.info("UserManager.revokeAccessToken: access token revoked successfully")}))},e.prototype._revokeInternal=function t(e,r){var n=this;if(e){var o=e.access_token,s=e.refresh_token;return this._revokeAccessTokenInternal(o,r).then((function(t){return n._revokeRefreshTokenInternal(s,r).then((function(e){return t||e||i.Log.debug("UserManager.revokeAccessToken: no need to revoke due to no token(s), or JWT format"),t||e}))}))}return Promise.resolve(!1)},e.prototype._revokeAccessTokenInternal=function t(e,r){return!e||e.indexOf(".")>=0?Promise.resolve(!1):this._tokenRevocationClient.revoke(e,r).then((function(){return!0}))},e.prototype._revokeRefreshTokenInternal=function t(e,r){return e?this._tokenRevocationClient.revoke(e,r,"refresh_token").then((function(){return!0})):Promise.resolve(!1)},e.prototype.startSilentRenew=function t(){this._silentRenewService.start()},e.prototype.stopSilentRenew=function t(){this._silentRenewService.stop()},e.prototype._loadUser=function t(){return this._userStore.get(this._userStoreKey).then((function(t){return t?(i.Log.debug("UserManager._loadUser: user storageString loaded"),a.User.fromStorageString(t)):(i.Log.debug("UserManager._loadUser: no user storageString"),null)}))},e.prototype.storeUser=function t(e){if(e){i.Log.debug("UserManager.storeUser: storing user");var r=e.toStorageString();return this._userStore.set(this._userStoreKey,r)}return i.Log.debug("storeUser.storeUser: removing user"),this._userStore.remove(this._userStoreKey)},n(e,[{key:"_redirectNavigator",get:function t(){return this.settings.redirectNavigator}},{key:"_popupNavigator",get:function t(){return this.settings.popupNavigator}},{key:"_iframeNavigator",get:function t(){return this.settings.iframeNavigator}},{key:"_userStore",get:function t(){return this.settings.userStore}},{key:"events",get:function t(){return this._events}},{key:"_userStoreKey",get:function t(){return"user:"+this.settings.authority+":"+this.settings.client_id}}]),e}(o.OidcClient)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.UserManagerSettings=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=(r(0),r(5)),o=r(40),s=r(41),a=r(43),u=r(6),c=r(1),h=r(8);function l(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function f(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}e.UserManagerSettings=function(t){function e(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=r.popup_redirect_uri,i=r.popup_post_logout_redirect_uri,g=r.popupWindowFeatures,d=r.popupWindowTarget,p=r.silent_redirect_uri,v=r.silentRequestTimeout,y=r.automaticSilentRenew,m=void 0!==y&&y,_=r.validateSubOnSilentRenew,S=void 0!==_&&_,w=r.includeIdTokenInSilentRenew,b=void 0===w||w,F=r.monitorSession,E=void 0===F||F,x=r.monitorAnonymousSession,A=void 0!==x&&x,k=r.checkSessionInterval,P=void 0===k?2e3:k,C=r.stopCheckSessionOnError,T=void 0===C||C,R=r.query_status_response_type,I=r.revokeAccessTokenOnSignout,D=void 0!==I&&I,N=r.accessTokenExpiringNotificationTime,L=void 0===N?60:N,U=r.redirectNavigator,B=void 0===U?new o.RedirectNavigator:U,O=r.popupNavigator,j=void 0===O?new s.PopupNavigator:O,M=r.iframeNavigator,H=void 0===M?new a.IFrameNavigator:M,V=r.userStore,K=void 0===V?new u.WebStorageStateStore({store:c.Global.sessionStorage}):V;l(this,e);var q=f(this,t.call(this,arguments[0]));return q._popup_redirect_uri=n,q._popup_post_logout_redirect_uri=i,q._popupWindowFeatures=g,q._popupWindowTarget=d,q._silent_redirect_uri=p,q._silentRequestTimeout=v,q._automaticSilentRenew=m,q._validateSubOnSilentRenew=S,q._includeIdTokenInSilentRenew=b,q._accessTokenExpiringNotificationTime=L,q._monitorSession=E,q._monitorAnonymousSession=A,q._checkSessionInterval=P,q._stopCheckSessionOnError=T,R?q._query_status_response_type=R:arguments[0]&&arguments[0].response_type?q._query_status_response_type=h.SigninRequest.isOidc(arguments[0].response_type)?"id_token":"code":q._query_status_response_type="id_token",q._revokeAccessTokenOnSignout=D,q._redirectNavigator=B,q._popupNavigator=j,q._iframeNavigator=H,q._userStore=K,q}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),n(e,[{key:"popup_redirect_uri",get:function t(){return this._popup_redirect_uri}},{key:"popup_post_logout_redirect_uri",get:function t(){return this._popup_post_logout_redirect_uri}},{key:"popupWindowFeatures",get:function t(){return this._popupWindowFeatures}},{key:"popupWindowTarget",get:function t(){return this._popupWindowTarget}},{key:"silent_redirect_uri",get:function t(){return this._silent_redirect_uri}},{key:"silentRequestTimeout",get:function t(){return this._silentRequestTimeout}},{key:"automaticSilentRenew",get:function t(){return this._automaticSilentRenew}},{key:"validateSubOnSilentRenew",get:function t(){return this._validateSubOnSilentRenew}},{key:"includeIdTokenInSilentRenew",get:function t(){return this._includeIdTokenInSilentRenew}},{key:"accessTokenExpiringNotificationTime",get:function t(){return this._accessTokenExpiringNotificationTime}},{key:"monitorSession",get:function t(){return this._monitorSession}},{key:"monitorAnonymousSession",get:function t(){return this._monitorAnonymousSession}},{key:"checkSessionInterval",get:function t(){return this._checkSessionInterval}},{key:"stopCheckSessionOnError",get:function t(){return this._stopCheckSessionOnError}},{key:"query_status_response_type",get:function t(){return this._query_status_response_type}},{key:"revokeAccessTokenOnSignout",get:function t(){return this._revokeAccessTokenOnSignout}},{key:"redirectNavigator",get:function t(){return this._redirectNavigator}},{key:"popupNavigator",get:function t(){return this._popupNavigator}},{key:"iframeNavigator",get:function t(){return this._iframeNavigator}},{key:"userStore",get:function t(){return this._userStore}}]),e}(i.OidcClientSettings)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.RedirectNavigator=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0);e.RedirectNavigator=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.prepare=function t(){return Promise.resolve(this)},t.prototype.navigate=function t(e){return e&&e.url?(e.useReplaceToNavigate?window.location.replace(e.url):window.location=e.url,Promise.resolve()):(i.Log.error("RedirectNavigator.navigate: No url provided"),Promise.reject(new Error("No url provided")))},n(t,[{key:"url",get:function t(){return window.location.href}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.PopupNavigator=void 0;var n=r(0),i=r(42);e.PopupNavigator=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.prepare=function t(e){var r=new i.PopupWindow(e);return Promise.resolve(r)},t.prototype.callback=function t(e,r,o){n.Log.debug("PopupNavigator.callback");try{return i.PopupWindow.notifyOpener(e,r,o),Promise.resolve()}catch(t){return Promise.reject(t)}},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.PopupWindow=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(3);e.PopupWindow=function(){function t(e){var r=this;!function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this._promise=new Promise((function(t,e){r._resolve=t,r._reject=e}));var o=e.popupWindowTarget||"_blank",s=e.popupWindowFeatures||"location=no,toolbar=no,width=500,height=500,left=100,top=100;";this._popup=window.open("",o,s),this._popup&&(i.Log.debug("PopupWindow.ctor: popup successfully created"),this._checkForPopupClosedTimer=window.setInterval(this._checkForPopupClosed.bind(this),500))}return t.prototype.navigate=function t(e){return this._popup?e&&e.url?(i.Log.debug("PopupWindow.navigate: Setting URL in popup"),this._id=e.id,this._id&&(window["popupCallback_"+e.id]=this._callback.bind(this)),this._popup.focus(),this._popup.window.location=e.url):(this._error("PopupWindow.navigate: no url provided"),this._error("No url provided")):this._error("PopupWindow.navigate: Error opening popup window"),this.promise},t.prototype._success=function t(e){i.Log.debug("PopupWindow.callback: Successful response from popup window"),this._cleanup(),this._resolve(e)},t.prototype._error=function t(e){i.Log.error("PopupWindow.error: ",e),this._cleanup(),this._reject(new Error(e))},t.prototype.close=function t(){this._cleanup(!1)},t.prototype._cleanup=function t(e){i.Log.debug("PopupWindow.cleanup"),window.clearInterval(this._checkForPopupClosedTimer),this._checkForPopupClosedTimer=null,delete window["popupCallback_"+this._id],this._popup&&!e&&this._popup.close(),this._popup=null},t.prototype._checkForPopupClosed=function t(){this._popup&&!this._popup.closed||this._error("Popup window closed")},t.prototype._callback=function t(e,r){this._cleanup(r),e?(i.Log.debug("PopupWindow.callback success"),this._success({url:e})):(i.Log.debug("PopupWindow.callback: Invalid response from popup"),this._error("Invalid response from popup"))},t.notifyOpener=function t(e,r,n){if(window.opener){if(e=e||window.location.href){var s=o.UrlUtility.parseUrlFragment(e,n);if(s.state){var a="popupCallback_"+s.state,u=window.opener[a];u?(i.Log.debug("PopupWindow.notifyOpener: passing url message to opener"),u(e,r)):i.Log.warn("PopupWindow.notifyOpener: no matching callback found on opener")}else i.Log.warn("PopupWindow.notifyOpener: no state found in response url")}}else i.Log.warn("PopupWindow.notifyOpener: no window.opener. Can't complete notification.")},n(t,[{key:"promise",get:function t(){return this._promise}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.IFrameNavigator=void 0;var n=r(0),i=r(44);e.IFrameNavigator=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.prepare=function t(e){var r=new i.IFrameWindow(e);return Promise.resolve(r)},t.prototype.callback=function t(e){n.Log.debug("IFrameNavigator.callback");try{return i.IFrameWindow.notifyParent(e),Promise.resolve()}catch(t){return Promise.reject(t)}},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.IFrameWindow=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0);e.IFrameWindow=function(){function t(e){var r=this;!function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this._promise=new Promise((function(t,e){r._resolve=t,r._reject=e})),this._boundMessageEvent=this._message.bind(this),window.addEventListener("message",this._boundMessageEvent,!1),this._frame=window.document.createElement("iframe"),this._frame.style.visibility="hidden",this._frame.style.position="absolute",this._frame.width=0,this._frame.height=0,window.document.body.appendChild(this._frame)}return t.prototype.navigate=function t(e){if(e&&e.url){var r=e.silentRequestTimeout||1e4;i.Log.debug("IFrameWindow.navigate: Using timeout of:",r),this._timer=window.setTimeout(this._timeout.bind(this),r),this._frame.src=e.url}else this._error("No url provided");return this.promise},t.prototype._success=function t(e){this._cleanup(),i.Log.debug("IFrameWindow: Successful response from frame window"),this._resolve(e)},t.prototype._error=function t(e){this._cleanup(),i.Log.error(e),this._reject(new Error(e))},t.prototype.close=function t(){this._cleanup()},t.prototype._cleanup=function t(){this._frame&&(i.Log.debug("IFrameWindow: cleanup"),window.removeEventListener("message",this._boundMessageEvent,!1),window.clearTimeout(this._timer),window.document.body.removeChild(this._frame),this._timer=null,this._frame=null,this._boundMessageEvent=null)},t.prototype._timeout=function t(){i.Log.debug("IFrameWindow.timeout"),this._error("Frame window timed out")},t.prototype._message=function t(e){if(i.Log.debug("IFrameWindow.message"),this._timer&&e.origin===this._origin&&e.source===this._frame.contentWindow&&"string"==typeof e.data&&(e.data.startsWith("http://")||e.data.startsWith("https://"))){var r=e.data;r?this._success({url:r}):this._error("Invalid response from frame")}},t.notifyParent=function t(e){i.Log.debug("IFrameWindow.notifyParent"),(e=e||window.location.href)&&(i.Log.debug("IFrameWindow.notifyParent: posting url message to parent"),window.parent.postMessage(e,location.protocol+"//"+location.host))},n(t,[{key:"promise",get:function t(){return this._promise}},{key:"_origin",get:function t(){return location.protocol+"//"+location.host}}]),t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.UserManagerEvents=void 0;var n=r(0),i=r(16),o=r(17);e.UserManagerEvents=function(t){function e(r){!function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,e);var i=function s(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}(this,t.call(this,r));return i._userLoaded=new o.Event("User loaded"),i._userUnloaded=new o.Event("User unloaded"),i._silentRenewError=new o.Event("Silent renew error"),i._userSignedIn=new o.Event("User signed in"),i._userSignedOut=new o.Event("User signed out"),i._userSessionChanged=new o.Event("User session changed"),i}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),e.prototype.load=function e(r){var i=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];n.Log.debug("UserManagerEvents.load"),t.prototype.load.call(this,r),i&&this._userLoaded.raise(r)},e.prototype.unload=function e(){n.Log.debug("UserManagerEvents.unload"),t.prototype.unload.call(this),this._userUnloaded.raise()},e.prototype.addUserLoaded=function t(e){this._userLoaded.addHandler(e)},e.prototype.removeUserLoaded=function t(e){this._userLoaded.removeHandler(e)},e.prototype.addUserUnloaded=function t(e){this._userUnloaded.addHandler(e)},e.prototype.removeUserUnloaded=function t(e){this._userUnloaded.removeHandler(e)},e.prototype.addSilentRenewError=function t(e){this._silentRenewError.addHandler(e)},e.prototype.removeSilentRenewError=function t(e){this._silentRenewError.removeHandler(e)},e.prototype._raiseSilentRenewError=function t(e){n.Log.debug("UserManagerEvents._raiseSilentRenewError",e.message),this._silentRenewError.raise(e)},e.prototype.addUserSignedIn=function t(e){this._userSignedIn.addHandler(e)},e.prototype.removeUserSignedIn=function t(e){this._userSignedIn.removeHandler(e)},e.prototype._raiseUserSignedIn=function t(){n.Log.debug("UserManagerEvents._raiseUserSignedIn"),this._userSignedIn.raise()},e.prototype.addUserSignedOut=function t(e){this._userSignedOut.addHandler(e)},e.prototype.removeUserSignedOut=function t(e){this._userSignedOut.removeHandler(e)},e.prototype._raiseUserSignedOut=function t(){n.Log.debug("UserManagerEvents._raiseUserSignedOut"),this._userSignedOut.raise()},e.prototype.addUserSessionChanged=function t(e){this._userSessionChanged.addHandler(e)},e.prototype.removeUserSessionChanged=function t(e){this._userSessionChanged.removeHandler(e)},e.prototype._raiseUserSessionChanged=function t(){n.Log.debug("UserManagerEvents._raiseUserSessionChanged"),this._userSessionChanged.raise()},e}(i.AccessTokenEvents)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.Timer=void 0;var n=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),i=r(0),o=r(1),s=r(17);function a(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function u(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}e.Timer=function(t){function e(r){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:o.Global.timer,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:void 0;a(this,e);var s=u(this,t.call(this,r));return s._timer=n,s._nowFunc=i||function(){return Date.now()/1e3},s}return function r(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}(e,t),e.prototype.init=function t(e){e<=0&&(e=1),e=parseInt(e);var r=this.now+e;if(this.expiration===r&&this._timerHandle)i.Log.debug("Timer.init timer "+this._name+" skipping initialization since already initialized for expiration:",this.expiration);else{this.cancel(),i.Log.debug("Timer.init timer "+this._name+" for duration:",e),this._expiration=r;var n=5;e<n&&(n=e),this._timerHandle=this._timer.setInterval(this._callback.bind(this),1e3*n)}},e.prototype.cancel=function t(){this._timerHandle&&(i.Log.debug("Timer.cancel: ",this._name),this._timer.clearInterval(this._timerHandle),this._timerHandle=null)},e.prototype._callback=function e(){var r=this._expiration-this.now;i.Log.debug("Timer.callback; "+this._name+" timer expires in:",r),this._expiration<=this.now&&(this.cancel(),t.prototype.raise.call(this))},n(e,[{key:"now",get:function t(){return parseInt(this._nowFunc())}},{key:"expiration",get:function t(){return this._expiration}}]),e}(s.Event)},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.SilentRenewService=void 0;var n=r(0);e.SilentRenewService=function(){function t(e){!function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this._userManager=e}return t.prototype.start=function t(){this._callback||(this._callback=this._tokenExpiring.bind(this),this._userManager.events.addAccessTokenExpiring(this._callback),this._userManager.getUser().then((function(t){})).catch((function(t){n.Log.error("SilentRenewService.start: Error from getUser:",t.message)})))},t.prototype.stop=function t(){this._callback&&(this._userManager.events.removeAccessTokenExpiring(this._callback),delete this._callback)},t.prototype._tokenExpiring=function t(){var e=this;this._userManager.signinSilent().then((function(t){n.Log.debug("SilentRenewService._tokenExpiring: Silent token renewal successful")}),(function(t){n.Log.error("SilentRenewService._tokenExpiring: Error from signinSilent:",t.message),e._userManager.events._raiseSilentRenewError(t)}))},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.CordovaPopupNavigator=void 0;var n=r(21);e.CordovaPopupNavigator=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.prepare=function t(e){var r=new n.CordovaPopupWindow(e);return Promise.resolve(r)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.CordovaIFrameNavigator=void 0;var n=r(21);e.CordovaIFrameNavigator=function(){function t(){!function e(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t)}return t.prototype.prepare=function t(e){e.popupWindowFeatures="hidden=yes";var r=new n.CordovaPopupWindow(e);return Promise.resolve(r)},t}()},function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0});e.Version="1.11.6"}])}));

/***/ }),

/***/ "../core/dist/index.mjs":
/*!******************************!*\
  !*** ../core/dist/index.mjs ***!
  \******************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AggregateHandler": () => (/* binding */ AggregateHandler),
/* harmony export */   "ConfigurationError": () => (/* binding */ ConfigurationError),
/* harmony export */   "DEFAULT_SCOPES": () => (/* binding */ DEFAULT_SCOPES),
/* harmony export */   "EVENTS": () => (/* binding */ EVENTS),
/* harmony export */   "InMemoryStorage": () => (/* binding */ InMemoryStorage),
/* harmony export */   "InvalidResponseError": () => (/* binding */ InvalidResponseError),
/* harmony export */   "NotImplementedError": () => (/* binding */ NotImplementedError),
/* harmony export */   "OidcProviderError": () => (/* binding */ OidcProviderError),
/* harmony export */   "PREFERRED_SIGNING_ALG": () => (/* binding */ PREFERRED_SIGNING_ALG),
/* harmony export */   "REFRESH_BEFORE_EXPIRATION_SECONDS": () => (/* binding */ REFRESH_BEFORE_EXPIRATION_SECONDS),
/* harmony export */   "SOLID_CLIENT_AUTHN_KEY_PREFIX": () => (/* binding */ SOLID_CLIENT_AUTHN_KEY_PREFIX),
/* harmony export */   "StorageUtility": () => (/* binding */ StorageUtility),
/* harmony export */   "StorageUtilityGetResponse": () => (/* binding */ StorageUtilityGetResponse),
/* harmony export */   "StorageUtilityMock": () => (/* binding */ StorageUtilityMock),
/* harmony export */   "USER_SESSION_PREFIX": () => (/* binding */ USER_SESSION_PREFIX),
/* harmony export */   "buildAuthenticatedFetch": () => (/* binding */ buildAuthenticatedFetch),
/* harmony export */   "buildProxyHandler": () => (/* binding */ buildProxyHandler),
/* harmony export */   "createDpopHeader": () => (/* binding */ createDpopHeader),
/* harmony export */   "determineSigningAlg": () => (/* binding */ determineSigningAlg),
/* harmony export */   "fetchJwks": () => (/* binding */ fetchJwks),
/* harmony export */   "generateDpopKeyPair": () => (/* binding */ generateDpopKeyPair),
/* harmony export */   "getSessionIdFromOauthState": () => (/* binding */ getSessionIdFromOauthState),
/* harmony export */   "getWebidFromTokenPayload": () => (/* binding */ getWebidFromTokenPayload),
/* harmony export */   "handleRegistration": () => (/* binding */ handleRegistration),
/* harmony export */   "importDpopKeyPair": () => (/* binding */ importDpopKeyPair),
/* harmony export */   "isSupportedTokenType": () => (/* binding */ isSupportedTokenType),
/* harmony export */   "isValidRedirectUrl": () => (/* binding */ isValidRedirectUrl),
/* harmony export */   "loadOidcContextFromStorage": () => (/* binding */ loadOidcContextFromStorage),
/* harmony export */   "mockStorage": () => (/* binding */ mockStorage),
/* harmony export */   "mockStorageUtility": () => (/* binding */ mockStorageUtility),
/* harmony export */   "saveSessionInfoToStorage": () => (/* binding */ saveSessionInfoToStorage)
/* harmony export */ });
/* harmony import */ var events__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! events */ "../core/node_modules/events/events.js");
/* harmony import */ var _inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @inrupt/universal-fetch */ "../core/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs");
/* harmony import */ var jose__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jose */ "../core/node_modules/jose/dist/browser/index.js");
/* harmony import */ var uuid__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! uuid */ "../core/node_modules/uuid/dist/esm-browser/v4.js");





const SOLID_CLIENT_AUTHN_KEY_PREFIX = "solidClientAuthn:";
const PREFERRED_SIGNING_ALG = ["ES256", "RS256"];
const EVENTS = {
    ERROR: "error",
    LOGIN: "login",
    LOGOUT: "logout",
    NEW_REFRESH_TOKEN: "newRefreshToken",
    SESSION_EXPIRED: "sessionExpired",
    SESSION_EXTENDED: "sessionExtended",
    SESSION_RESTORED: "sessionRestore",
    TIMEOUT_SET: "timeoutSet",
};
const REFRESH_BEFORE_EXPIRATION_SECONDS = 5;
const SCOPE_OPENID = "openid";
const SCOPE_OFFLINE = "offline_access";
const SCOPE_WEBID = "webid";
const DEFAULT_SCOPES = [SCOPE_OPENID, SCOPE_OFFLINE, SCOPE_WEBID].join(" ");

const buildProxyHandler = (toExclude, errorMessage) => ({
    get(target, prop, receiver) {
        if (!Object.getOwnPropertyNames(events__WEBPACK_IMPORTED_MODULE_0__.EventEmitter).includes(prop) &&
            Object.getOwnPropertyNames(toExclude).includes(prop)) {
            throw new Error(`${errorMessage}: [${prop}] is not supported`);
        }
        return Reflect.get(target, prop, receiver);
    },
});

class AggregateHandler {
    constructor(handleables) {
        this.handleables = handleables;
    }
    async getProperHandler(params) {
        const canHandleList = await Promise.all(this.handleables.map((handleable) => handleable.canHandle(...params)));
        for (let i = 0; i < canHandleList.length; i += 1) {
            if (canHandleList[i]) {
                return this.handleables[i];
            }
        }
        return null;
    }
    async canHandle(...params) {
        return (await this.getProperHandler(params)) !== null;
    }
    async handle(...params) {
        const handler = await this.getProperHandler(params);
        if (handler) {
            return handler.handle(...params);
        }
        throw new Error(`[${this.constructor.name}] cannot find a suitable handler for: ${params
            .map((param) => {
            try {
                return JSON.stringify(param);
            }
            catch (err) {
                return param.toString();
            }
        })
            .join(", ")}`);
    }
}

async function fetchJwks(jwksIri, issuerIri) {
    const jwksResponse = await (0,_inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__.fetch)(jwksIri);
    if (jwksResponse.status !== 200) {
        throw new Error(`Could not fetch JWKS for [${issuerIri}] at [${jwksIri}]: ${jwksResponse.status} ${jwksResponse.statusText}`);
    }
    let jwk;
    try {
        jwk = (await jwksResponse.json()).keys[0];
    }
    catch (e) {
        throw new Error(`Malformed JWKS for [${issuerIri}] at [${jwksIri}]: ${e.message}`);
    }
    return jwk;
}
async function getWebidFromTokenPayload(idToken, jwksIri, issuerIri, clientId) {
    const jwk = await fetchJwks(jwksIri, issuerIri);
    let payload;
    try {
        const { payload: verifiedPayload } = await (0,jose__WEBPACK_IMPORTED_MODULE_1__.jwtVerify)(idToken, await (0,jose__WEBPACK_IMPORTED_MODULE_1__.importJWK)(jwk), {
            issuer: issuerIri,
            audience: clientId,
        });
        payload = verifiedPayload;
    }
    catch (e) {
        throw new Error(`Token verification failed: ${e.stack}`);
    }
    if (typeof payload.webid === "string") {
        return payload.webid;
    }
    if (typeof payload.sub !== "string") {
        throw new Error(`The token ${JSON.stringify(payload)} is invalid: it has no 'webid' claim and no 'sub' claim.`);
    }
    try {
        new URL(payload.sub);
        return payload.sub;
    }
    catch (e) {
        throw new Error(`The token has no 'webid' claim, and its 'sub' claim of [${payload.sub}] is invalid as a URL - error [${e}].`);
    }
}

function isValidRedirectUrl(redirectUrl) {
    try {
        const urlObject = new URL(redirectUrl);
        return urlObject.hash === "";
    }
    catch (e) {
        return false;
    }
}

function isSupportedTokenType(token) {
    return typeof token === "string" && ["DPoP", "Bearer"].includes(token);
}

const USER_SESSION_PREFIX = "solidClientAuthenticationUser";

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function determineSigningAlg(supported, preferred) {
    var _a;
    return ((_a = preferred.find((signingAlg) => {
        return supported.includes(signingAlg);
    })) !== null && _a !== void 0 ? _a : null);
}
function determineClientType(options, issuerConfig) {
    if (options.clientId !== undefined && !isValidUrl(options.clientId)) {
        return "static";
    }
    if (issuerConfig.scopesSupported.includes("webid") &&
        options.clientId !== undefined &&
        isValidUrl(options.clientId)) {
        return "solid-oidc";
    }
    return "dynamic";
}
async function handleRegistration(options, issuerConfig, storageUtility, clientRegistrar) {
    const clientType = determineClientType(options, issuerConfig);
    if (clientType === "dynamic") {
        return clientRegistrar.getClient({
            sessionId: options.sessionId,
            clientName: options.clientName,
            redirectUrl: options.redirectUrl,
        }, issuerConfig);
    }
    await storageUtility.setForUser(options.sessionId, {
        clientId: options.clientId,
    });
    if (options.clientSecret) {
        await storageUtility.setForUser(options.sessionId, {
            clientSecret: options.clientSecret,
        });
    }
    if (options.clientName) {
        await storageUtility.setForUser(options.sessionId, {
            clientName: options.clientName,
        });
    }
    return {
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        clientName: options.clientName,
        clientType,
    };
}

async function getSessionIdFromOauthState(storageUtility, oauthState) {
    return storageUtility.getForUser(oauthState, "sessionId");
}
async function loadOidcContextFromStorage(sessionId, storageUtility, configFetcher) {
    try {
        const [issuerIri, codeVerifier, storedRedirectIri, dpop] = await Promise.all([
            storageUtility.getForUser(sessionId, "issuer", {
                errorIfNull: true,
            }),
            storageUtility.getForUser(sessionId, "codeVerifier"),
            storageUtility.getForUser(sessionId, "redirectUrl"),
            storageUtility.getForUser(sessionId, "dpop", { errorIfNull: true }),
        ]);
        await storageUtility.deleteForUser(sessionId, "codeVerifier");
        const issuerConfig = await configFetcher.fetchConfig(issuerIri);
        return {
            codeVerifier,
            redirectUrl: storedRedirectIri,
            issuerConfig,
            dpop: dpop === "true",
        };
    }
    catch (e) {
        throw new Error(`Failed to retrieve OIDC context from storage associated with session [${sessionId}]: ${e}`);
    }
}
async function saveSessionInfoToStorage(storageUtility, sessionId, webId, isLoggedIn, refreshToken, secure, dpopKey) {
    if (refreshToken !== undefined) {
        await storageUtility.setForUser(sessionId, { refreshToken }, { secure });
    }
    if (webId !== undefined) {
        await storageUtility.setForUser(sessionId, { webId }, { secure });
    }
    if (isLoggedIn !== undefined) {
        await storageUtility.setForUser(sessionId, { isLoggedIn }, { secure });
    }
    if (dpopKey !== undefined) {
        await storageUtility.setForUser(sessionId, {
            publicKey: JSON.stringify(dpopKey.publicKey),
            privateKey: JSON.stringify(await (0,jose__WEBPACK_IMPORTED_MODULE_1__.exportJWK)(dpopKey.privateKey)),
        }, { secure });
    }
}
class StorageUtility {
    constructor(secureStorage, insecureStorage) {
        this.secureStorage = secureStorage;
        this.insecureStorage = insecureStorage;
    }
    getKey(userId) {
        return `solidClientAuthenticationUser:${userId}`;
    }
    async getUserData(userId, secure) {
        const stored = await (secure
            ? this.secureStorage
            : this.insecureStorage).get(this.getKey(userId));
        if (stored === undefined) {
            return {};
        }
        try {
            return JSON.parse(stored);
        }
        catch (err) {
            throw new Error(`Data for user [${userId}] in [${secure ? "secure" : "unsecure"}] storage is corrupted - expected valid JSON, but got: ${stored}`);
        }
    }
    async setUserData(userId, data, secure) {
        await (secure ? this.secureStorage : this.insecureStorage).set(this.getKey(userId), JSON.stringify(data));
    }
    async get(key, options) {
        const value = await ((options === null || options === void 0 ? void 0 : options.secure)
            ? this.secureStorage
            : this.insecureStorage).get(key);
        if (value === undefined && (options === null || options === void 0 ? void 0 : options.errorIfNull)) {
            throw new Error(`[${key}] is not stored`);
        }
        return value;
    }
    async set(key, value, options) {
        return ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).set(key, value);
    }
    async delete(key, options) {
        return ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).delete(key);
    }
    async getForUser(userId, key, options) {
        const userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        let value;
        if (!userData || !userData[key]) {
            value = undefined;
        }
        value = userData[key];
        if (value === undefined && (options === null || options === void 0 ? void 0 : options.errorIfNull)) {
            throw new Error(`Field [${key}] for user [${userId}] is not stored`);
        }
        return value || undefined;
    }
    async setForUser(userId, values, options) {
        let userData;
        try {
            userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        }
        catch (_a) {
            userData = {};
        }
        await this.setUserData(userId, { ...userData, ...values }, options === null || options === void 0 ? void 0 : options.secure);
    }
    async deleteForUser(userId, key, options) {
        const userData = await this.getUserData(userId, options === null || options === void 0 ? void 0 : options.secure);
        delete userData[key];
        await this.setUserData(userId, userData, options === null || options === void 0 ? void 0 : options.secure);
    }
    async deleteAllUserData(userId, options) {
        await ((options === null || options === void 0 ? void 0 : options.secure) ? this.secureStorage : this.insecureStorage).delete(this.getKey(userId));
    }
}

class InMemoryStorage {
    constructor() {
        this.map = {};
    }
    async get(key) {
        return this.map[key] || undefined;
    }
    async set(key, value) {
        this.map[key] = value;
    }
    async delete(key) {
        delete this.map[key];
    }
}

class ConfigurationError extends Error {
    constructor(message) {
        super(message);
    }
}

class NotImplementedError extends Error {
    constructor(methodName) {
        super(`[${methodName}] is not implemented`);
    }
}

class InvalidResponseError extends Error {
    constructor(missingFields) {
        super(`Invalid response from OIDC provider: missing fields ${missingFields}`);
        this.missingFields = missingFields;
    }
}

class OidcProviderError extends Error {
    constructor(message, error, errorDescription) {
        super(message);
        this.error = error;
        this.errorDescription = errorDescription;
    }
}

function normalizeHTU(audience) {
    const audienceUrl = new URL(audience);
    return new URL(audienceUrl.pathname, audienceUrl.origin).toString();
}
async function createDpopHeader(audience, method, dpopKey) {
    return new jose__WEBPACK_IMPORTED_MODULE_1__.SignJWT({
        htu: normalizeHTU(audience),
        htm: method.toUpperCase(),
        jti: (0,uuid__WEBPACK_IMPORTED_MODULE_3__["default"])(),
    })
        .setProtectedHeader({
        alg: PREFERRED_SIGNING_ALG[0],
        jwk: dpopKey.publicKey,
        typ: "dpop+jwt",
    })
        .setIssuedAt()
        .sign(dpopKey.privateKey, {});
}
async function generateDpopKeyPair() {
    const { privateKey, publicKey } = await (0,jose__WEBPACK_IMPORTED_MODULE_1__.generateKeyPair)(PREFERRED_SIGNING_ALG[0], { extractable: true });
    const dpopKeyPair = {
        privateKey,
        publicKey: await (0,jose__WEBPACK_IMPORTED_MODULE_1__.exportJWK)(publicKey),
        privateKeyJWK: await (0,jose__WEBPACK_IMPORTED_MODULE_1__.exportJWK)(privateKey)
    };
    [dpopKeyPair.publicKey.alg] = PREFERRED_SIGNING_ALG;
    [dpopKeyPair.privateKeyJWK.alg] = PREFERRED_SIGNING_ALG;
    return dpopKeyPair;
}
async function importDpopKeyPair(pubKey, privKey) {
    const publicKey = pubKey;
    const privateKeyJWK = privKey;
    const key = await (0,jose__WEBPACK_IMPORTED_MODULE_1__.importJWK)(privateKeyJWK);
    const dpopKeyPair = {
        privateKey: key,
        publicKey,
        privateKeyJWK
    };
    return dpopKeyPair;
}

const DEFAULT_EXPIRATION_TIME_SECONDS = 600;
function isExpectedAuthError(statusCode) {
    return [401, 403].includes(statusCode);
}
async function buildDpopFetchOptions(targetUrl, authToken, dpopKey, defaultOptions) {
    var _a;
    const headers = new _inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__.Headers(defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.headers);
    headers.set("Authorization", `DPoP ${authToken}`);
    headers.set("DPoP", await createDpopHeader(targetUrl, (_a = defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.method) !== null && _a !== void 0 ? _a : "get", dpopKey));
    return {
        ...defaultOptions,
        headers,
    };
}
async function buildAuthenticatedHeaders(targetUrl, authToken, dpopKey, defaultOptions) {
    if (dpopKey !== undefined) {
        return buildDpopFetchOptions(targetUrl, authToken, dpopKey, defaultOptions);
    }
    const headers = new _inrupt_universal_fetch__WEBPACK_IMPORTED_MODULE_2__.Headers(defaultOptions === null || defaultOptions === void 0 ? void 0 : defaultOptions.headers);
    headers.set("Authorization", `Bearer ${authToken}`);
    return {
        ...defaultOptions,
        headers,
    };
}
async function makeAuthenticatedRequest(unauthFetch, accessToken, url, defaultRequestInit, dpopKey) {
    return unauthFetch(url, await buildAuthenticatedHeaders(url.toString(), accessToken, dpopKey, defaultRequestInit));
}
async function refreshAccessToken(refreshOptions, dpopKey, eventEmitter) {
    var _a;
    const tokenSet = await refreshOptions.tokenRefresher.refresh(refreshOptions.sessionId, refreshOptions.refreshToken, dpopKey);
    eventEmitter === null || eventEmitter === void 0 ? void 0 : eventEmitter.emit(EVENTS.SESSION_EXTENDED, (_a = tokenSet.expiresIn) !== null && _a !== void 0 ? _a : DEFAULT_EXPIRATION_TIME_SECONDS);
    if (typeof tokenSet.refreshToken === "string") {
        eventEmitter === null || eventEmitter === void 0 ? void 0 : eventEmitter.emit(EVENTS.NEW_REFRESH_TOKEN, tokenSet.refreshToken);
    }
    return {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        expiresIn: tokenSet.expiresIn,
    };
}
const computeRefreshDelay = (expiresIn) => {
    if (expiresIn !== undefined) {
        return expiresIn - REFRESH_BEFORE_EXPIRATION_SECONDS > 0
            ?
                expiresIn - REFRESH_BEFORE_EXPIRATION_SECONDS
            : expiresIn;
    }
    return DEFAULT_EXPIRATION_TIME_SECONDS;
};
async function buildAuthenticatedFetch(unauthFetch, accessToken, options) {
    var _a;
    let currentAccessToken = accessToken;
    let latestTimeout;
    const currentRefreshOptions = options === null || options === void 0 ? void 0 : options.refreshOptions;
    if (currentRefreshOptions !== undefined) {
        const proactivelyRefreshToken = async () => {
            var _a, _b, _c, _d;
            try {
                const { accessToken: refreshedAccessToken, refreshToken, expiresIn, } = await refreshAccessToken(currentRefreshOptions, options.dpopKey, options.eventEmitter);
                currentAccessToken = refreshedAccessToken;
                if (refreshToken !== undefined) {
                    currentRefreshOptions.refreshToken = refreshToken;
                }
                clearTimeout(latestTimeout);
                latestTimeout = setTimeout(proactivelyRefreshToken, computeRefreshDelay(expiresIn) * 1000);
                (_a = options.eventEmitter) === null || _a === void 0 ? void 0 : _a.emit(EVENTS.TIMEOUT_SET, latestTimeout);
            }
            catch (e) {
                if (e instanceof OidcProviderError) {
                    (_b = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _b === void 0 ? void 0 : _b.emit(EVENTS.ERROR, e.error, e.errorDescription);
                    (_c = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _c === void 0 ? void 0 : _c.emit(EVENTS.SESSION_EXPIRED);
                }
                if (e instanceof InvalidResponseError &&
                    e.missingFields.includes("access_token")) {
                    (_d = options === null || options === void 0 ? void 0 : options.eventEmitter) === null || _d === void 0 ? void 0 : _d.emit(EVENTS.SESSION_EXPIRED);
                }
            }
        };
        latestTimeout = setTimeout(proactivelyRefreshToken, computeRefreshDelay(options.expiresIn) * 1000);
        (_a = options.eventEmitter) === null || _a === void 0 ? void 0 : _a.emit(EVENTS.TIMEOUT_SET, latestTimeout);
    }
    else if (options !== undefined && options.eventEmitter !== undefined) {
        const expirationTimeout = setTimeout(() => {
            options.eventEmitter.emit(EVENTS.SESSION_EXPIRED);
        }, computeRefreshDelay(options.expiresIn) * 1000);
        options.eventEmitter.emit(EVENTS.TIMEOUT_SET, expirationTimeout);
    }
    return async (url, requestInit) => {
        let response = await makeAuthenticatedRequest(unauthFetch, currentAccessToken, url, requestInit, options === null || options === void 0 ? void 0 : options.dpopKey);
        const failedButNotExpectedAuthError = !response.ok && !isExpectedAuthError(response.status);
        if (response.ok || failedButNotExpectedAuthError) {
            return response;
        }
        const hasBeenRedirected = response.url !== url;
        if (hasBeenRedirected && (options === null || options === void 0 ? void 0 : options.dpopKey) !== undefined) {
            response = await makeAuthenticatedRequest(unauthFetch, currentAccessToken, response.url, requestInit, options.dpopKey);
        }
        return response;
    };
}

const StorageUtilityGetResponse = "getResponse";
const StorageUtilityMock = {
    get: async (key, options) => StorageUtilityGetResponse,
    set: async (key, value) => {
    },
    delete: async (key) => {
    },
    getForUser: async (userId, key, options) => StorageUtilityGetResponse,
    setForUser: async (userId, values, options) => {
    },
    deleteForUser: async (userId, key, options) => {
    },
    deleteAllUserData: async (userId, options) => {
    },
};
const mockStorage = (stored) => {
    const store = stored;
    return {
        get: async (key) => {
            if (store[key] === undefined) {
                return undefined;
            }
            if (typeof store[key] === "string") {
                return store[key];
            }
            return JSON.stringify(store[key]);
        },
        set: async (key, value) => {
            store[key] = value;
        },
        delete: async (key) => {
            delete store[key];
        },
    };
};
const mockStorageUtility = (stored, isSecure = false) => {
    if (isSecure) {
        return new StorageUtility(mockStorage(stored), mockStorage({}));
    }
    return new StorageUtility(mockStorage({}), mockStorage(stored));
};




/***/ }),

/***/ "../core/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs":
/*!***************************************************************************!*\
  !*** ../core/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs ***!
  \***************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Headers": () => (/* binding */ Headers),
/* harmony export */   "Request": () => (/* binding */ Request),
/* harmony export */   "Response": () => (/* binding */ Response),
/* harmony export */   "default": () => (/* binding */ indexBrowser),
/* harmony export */   "fetch": () => (/* binding */ fetch)
/* harmony export */ });
var indexBrowser = globalThis.fetch;
const { fetch, Response, Request, Headers } = globalThis;




/***/ }),

/***/ "../core/node_modules/jose/dist/browser/index.js":
/*!*******************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/index.js ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompactEncrypt": () => (/* reexport safe */ _jwe_compact_encrypt_js__WEBPACK_IMPORTED_MODULE_9__.CompactEncrypt),
/* harmony export */   "CompactSign": () => (/* reexport safe */ _jws_compact_sign_js__WEBPACK_IMPORTED_MODULE_11__.CompactSign),
/* harmony export */   "EmbeddedJWK": () => (/* reexport safe */ _jwk_embedded_js__WEBPACK_IMPORTED_MODULE_17__.EmbeddedJWK),
/* harmony export */   "EncryptJWT": () => (/* reexport safe */ _jwt_encrypt_js__WEBPACK_IMPORTED_MODULE_15__.EncryptJWT),
/* harmony export */   "FlattenedEncrypt": () => (/* reexport safe */ _jwe_flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_10__.FlattenedEncrypt),
/* harmony export */   "FlattenedSign": () => (/* reexport safe */ _jws_flattened_sign_js__WEBPACK_IMPORTED_MODULE_12__.FlattenedSign),
/* harmony export */   "GeneralEncrypt": () => (/* reexport safe */ _jwe_general_encrypt_js__WEBPACK_IMPORTED_MODULE_3__.GeneralEncrypt),
/* harmony export */   "GeneralSign": () => (/* reexport safe */ _jws_general_sign_js__WEBPACK_IMPORTED_MODULE_13__.GeneralSign),
/* harmony export */   "SignJWT": () => (/* reexport safe */ _jwt_sign_js__WEBPACK_IMPORTED_MODULE_14__.SignJWT),
/* harmony export */   "UnsecuredJWT": () => (/* reexport safe */ _jwt_unsecured_js__WEBPACK_IMPORTED_MODULE_20__.UnsecuredJWT),
/* harmony export */   "base64url": () => (/* reexport module object */ _util_base64url_js__WEBPACK_IMPORTED_MODULE_28__),
/* harmony export */   "calculateJwkThumbprint": () => (/* reexport safe */ _jwk_thumbprint_js__WEBPACK_IMPORTED_MODULE_16__.calculateJwkThumbprint),
/* harmony export */   "calculateJwkThumbprintUri": () => (/* reexport safe */ _jwk_thumbprint_js__WEBPACK_IMPORTED_MODULE_16__.calculateJwkThumbprintUri),
/* harmony export */   "compactDecrypt": () => (/* reexport safe */ _jwe_compact_decrypt_js__WEBPACK_IMPORTED_MODULE_0__.compactDecrypt),
/* harmony export */   "compactVerify": () => (/* reexport safe */ _jws_compact_verify_js__WEBPACK_IMPORTED_MODULE_4__.compactVerify),
/* harmony export */   "createLocalJWKSet": () => (/* reexport safe */ _jwks_local_js__WEBPACK_IMPORTED_MODULE_18__.createLocalJWKSet),
/* harmony export */   "createRemoteJWKSet": () => (/* reexport safe */ _jwks_remote_js__WEBPACK_IMPORTED_MODULE_19__.createRemoteJWKSet),
/* harmony export */   "decodeJwt": () => (/* reexport safe */ _util_decode_jwt_js__WEBPACK_IMPORTED_MODULE_24__.decodeJwt),
/* harmony export */   "decodeProtectedHeader": () => (/* reexport safe */ _util_decode_protected_header_js__WEBPACK_IMPORTED_MODULE_23__.decodeProtectedHeader),
/* harmony export */   "errors": () => (/* reexport module object */ _util_errors_js__WEBPACK_IMPORTED_MODULE_25__),
/* harmony export */   "exportJWK": () => (/* reexport safe */ _key_export_js__WEBPACK_IMPORTED_MODULE_21__.exportJWK),
/* harmony export */   "exportPKCS8": () => (/* reexport safe */ _key_export_js__WEBPACK_IMPORTED_MODULE_21__.exportPKCS8),
/* harmony export */   "exportSPKI": () => (/* reexport safe */ _key_export_js__WEBPACK_IMPORTED_MODULE_21__.exportSPKI),
/* harmony export */   "flattenedDecrypt": () => (/* reexport safe */ _jwe_flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_1__.flattenedDecrypt),
/* harmony export */   "flattenedVerify": () => (/* reexport safe */ _jws_flattened_verify_js__WEBPACK_IMPORTED_MODULE_5__.flattenedVerify),
/* harmony export */   "generalDecrypt": () => (/* reexport safe */ _jwe_general_decrypt_js__WEBPACK_IMPORTED_MODULE_2__.generalDecrypt),
/* harmony export */   "generalVerify": () => (/* reexport safe */ _jws_general_verify_js__WEBPACK_IMPORTED_MODULE_6__.generalVerify),
/* harmony export */   "generateKeyPair": () => (/* reexport safe */ _key_generate_key_pair_js__WEBPACK_IMPORTED_MODULE_26__.generateKeyPair),
/* harmony export */   "generateSecret": () => (/* reexport safe */ _key_generate_secret_js__WEBPACK_IMPORTED_MODULE_27__.generateSecret),
/* harmony export */   "importJWK": () => (/* reexport safe */ _key_import_js__WEBPACK_IMPORTED_MODULE_22__.importJWK),
/* harmony export */   "importPKCS8": () => (/* reexport safe */ _key_import_js__WEBPACK_IMPORTED_MODULE_22__.importPKCS8),
/* harmony export */   "importSPKI": () => (/* reexport safe */ _key_import_js__WEBPACK_IMPORTED_MODULE_22__.importSPKI),
/* harmony export */   "importX509": () => (/* reexport safe */ _key_import_js__WEBPACK_IMPORTED_MODULE_22__.importX509),
/* harmony export */   "jwtDecrypt": () => (/* reexport safe */ _jwt_decrypt_js__WEBPACK_IMPORTED_MODULE_8__.jwtDecrypt),
/* harmony export */   "jwtVerify": () => (/* reexport safe */ _jwt_verify_js__WEBPACK_IMPORTED_MODULE_7__.jwtVerify)
/* harmony export */ });
/* harmony import */ var _jwe_compact_decrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./jwe/compact/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/compact/decrypt.js");
/* harmony import */ var _jwe_flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./jwe/flattened/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/decrypt.js");
/* harmony import */ var _jwe_general_decrypt_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./jwe/general/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/general/decrypt.js");
/* harmony import */ var _jwe_general_encrypt_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./jwe/general/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/general/encrypt.js");
/* harmony import */ var _jws_compact_verify_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./jws/compact/verify.js */ "../core/node_modules/jose/dist/browser/jws/compact/verify.js");
/* harmony import */ var _jws_flattened_verify_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./jws/flattened/verify.js */ "../core/node_modules/jose/dist/browser/jws/flattened/verify.js");
/* harmony import */ var _jws_general_verify_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./jws/general/verify.js */ "../core/node_modules/jose/dist/browser/jws/general/verify.js");
/* harmony import */ var _jwt_verify_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./jwt/verify.js */ "../core/node_modules/jose/dist/browser/jwt/verify.js");
/* harmony import */ var _jwt_decrypt_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./jwt/decrypt.js */ "../core/node_modules/jose/dist/browser/jwt/decrypt.js");
/* harmony import */ var _jwe_compact_encrypt_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./jwe/compact/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/compact/encrypt.js");
/* harmony import */ var _jwe_flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./jwe/flattened/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/encrypt.js");
/* harmony import */ var _jws_compact_sign_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./jws/compact/sign.js */ "../core/node_modules/jose/dist/browser/jws/compact/sign.js");
/* harmony import */ var _jws_flattened_sign_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./jws/flattened/sign.js */ "../core/node_modules/jose/dist/browser/jws/flattened/sign.js");
/* harmony import */ var _jws_general_sign_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./jws/general/sign.js */ "../core/node_modules/jose/dist/browser/jws/general/sign.js");
/* harmony import */ var _jwt_sign_js__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./jwt/sign.js */ "../core/node_modules/jose/dist/browser/jwt/sign.js");
/* harmony import */ var _jwt_encrypt_js__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./jwt/encrypt.js */ "../core/node_modules/jose/dist/browser/jwt/encrypt.js");
/* harmony import */ var _jwk_thumbprint_js__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./jwk/thumbprint.js */ "../core/node_modules/jose/dist/browser/jwk/thumbprint.js");
/* harmony import */ var _jwk_embedded_js__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./jwk/embedded.js */ "../core/node_modules/jose/dist/browser/jwk/embedded.js");
/* harmony import */ var _jwks_local_js__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./jwks/local.js */ "../core/node_modules/jose/dist/browser/jwks/local.js");
/* harmony import */ var _jwks_remote_js__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./jwks/remote.js */ "../core/node_modules/jose/dist/browser/jwks/remote.js");
/* harmony import */ var _jwt_unsecured_js__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./jwt/unsecured.js */ "../core/node_modules/jose/dist/browser/jwt/unsecured.js");
/* harmony import */ var _key_export_js__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./key/export.js */ "../core/node_modules/jose/dist/browser/key/export.js");
/* harmony import */ var _key_import_js__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./key/import.js */ "../core/node_modules/jose/dist/browser/key/import.js");
/* harmony import */ var _util_decode_protected_header_js__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./util/decode_protected_header.js */ "../core/node_modules/jose/dist/browser/util/decode_protected_header.js");
/* harmony import */ var _util_decode_jwt_js__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! ./util/decode_jwt.js */ "../core/node_modules/jose/dist/browser/util/decode_jwt.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _key_generate_key_pair_js__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./key/generate_key_pair.js */ "../core/node_modules/jose/dist/browser/key/generate_key_pair.js");
/* harmony import */ var _key_generate_secret_js__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./key/generate_secret.js */ "../core/node_modules/jose/dist/browser/key/generate_secret.js");
/* harmony import */ var _util_base64url_js__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./util/base64url.js */ "../core/node_modules/jose/dist/browser/util/base64url.js");

































/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/compact/decrypt.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/compact/decrypt.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "compactDecrypt": () => (/* binding */ compactDecrypt)
/* harmony export */ });
/* harmony import */ var _flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/decrypt.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");



async function compactDecrypt(jwe, key, options) {
    if (jwe instanceof Uint8Array) {
        jwe = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__.decoder.decode(jwe);
    }
    if (typeof jwe !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('Compact JWE must be a string or Uint8Array');
    }
    const { 0: protectedHeader, 1: encryptedKey, 2: iv, 3: ciphertext, 4: tag, length, } = jwe.split('.');
    if (length !== 5) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('Invalid Compact JWE');
    }
    const decrypted = await (0,_flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_0__.flattenedDecrypt)({
        ciphertext,
        iv: (iv || undefined),
        protected: protectedHeader || undefined,
        tag: (tag || undefined),
        encrypted_key: encryptedKey || undefined,
    }, key, options);
    const result = { plaintext: decrypted.plaintext, protectedHeader: decrypted.protectedHeader };
    if (typeof key === 'function') {
        return { ...result, key: decrypted.key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/compact/encrypt.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/compact/encrypt.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompactEncrypt": () => (/* binding */ CompactEncrypt)
/* harmony export */ });
/* harmony import */ var _flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/encrypt.js");

class CompactEncrypt {
    constructor(plaintext) {
        this._flattened = new _flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__.FlattenedEncrypt(plaintext);
    }
    setContentEncryptionKey(cek) {
        this._flattened.setContentEncryptionKey(cek);
        return this;
    }
    setInitializationVector(iv) {
        this._flattened.setInitializationVector(iv);
        return this;
    }
    setProtectedHeader(protectedHeader) {
        this._flattened.setProtectedHeader(protectedHeader);
        return this;
    }
    setKeyManagementParameters(parameters) {
        this._flattened.setKeyManagementParameters(parameters);
        return this;
    }
    async encrypt(key, options) {
        const jwe = await this._flattened.encrypt(key, options);
        return [jwe.protected, jwe.encrypted_key, jwe.iv, jwe.ciphertext, jwe.tag].join('.');
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/flattened/decrypt.js":
/*!***********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/flattened/decrypt.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flattenedDecrypt": () => (/* binding */ flattenedDecrypt)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _runtime_decrypt_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../runtime/decrypt.js */ "../core/node_modules/jose/dist/browser/runtime/decrypt.js");
/* harmony import */ var _runtime_zlib_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../runtime/zlib.js */ "../core/node_modules/jose/dist/browser/runtime/zlib.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/is_disjoint.js */ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _lib_decrypt_key_management_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../lib/decrypt_key_management.js */ "../core/node_modules/jose/dist/browser/lib/decrypt_key_management.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_cek_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../lib/cek.js */ "../core/node_modules/jose/dist/browser/lib/cek.js");
/* harmony import */ var _lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../lib/validate_crit.js */ "../core/node_modules/jose/dist/browser/lib/validate_crit.js");
/* harmony import */ var _lib_validate_algorithms_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../../lib/validate_algorithms.js */ "../core/node_modules/jose/dist/browser/lib/validate_algorithms.js");











async function flattenedDecrypt(jwe, key, options) {
    var _a;
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__["default"])(jwe)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('Flattened JWE must be an object');
    }
    if (jwe.protected === undefined && jwe.header === undefined && jwe.unprotected === undefined) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JOSE Header missing');
    }
    if (typeof jwe.iv !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Initialization Vector missing or incorrect type');
    }
    if (typeof jwe.ciphertext !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Ciphertext missing or incorrect type');
    }
    if (typeof jwe.tag !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Authentication Tag missing or incorrect type');
    }
    if (jwe.protected !== undefined && typeof jwe.protected !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Protected Header incorrect type');
    }
    if (jwe.encrypted_key !== undefined && typeof jwe.encrypted_key !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Encrypted Key incorrect type');
    }
    if (jwe.aad !== undefined && typeof jwe.aad !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE AAD incorrect type');
    }
    if (jwe.header !== undefined && !(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__["default"])(jwe.header)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Shared Unprotected Header incorrect type');
    }
    if (jwe.unprotected !== undefined && !(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__["default"])(jwe.unprotected)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Per-Recipient Unprotected Header incorrect type');
    }
    let parsedProt;
    if (jwe.protected) {
        try {
            const protectedHeader = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.protected);
            parsedProt = JSON.parse(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.decoder.decode(protectedHeader));
        }
        catch (_b) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Protected Header is invalid');
        }
    }
    if (!(0,_lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_4__["default"])(parsedProt, jwe.header, jwe.unprotected)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE Protected, JWE Unprotected Header, and JWE Per-Recipient Unprotected Header Parameter names must be disjoint');
    }
    const joseHeader = {
        ...parsedProt,
        ...jwe.header,
        ...jwe.unprotected,
    };
    (0,_lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_9__["default"])(_util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid, new Map(), options === null || options === void 0 ? void 0 : options.crit, parsedProt, joseHeader);
    if (joseHeader.zip !== undefined) {
        if (!parsedProt || !parsedProt.zip) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
        }
        if (joseHeader.zip !== 'DEF') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSENotSupported('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value');
        }
    }
    const { alg, enc } = joseHeader;
    if (typeof alg !== 'string' || !alg) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('missing JWE Algorithm (alg) in JWE Header');
    }
    if (typeof enc !== 'string' || !enc) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid('missing JWE Encryption Algorithm (enc) in JWE Header');
    }
    const keyManagementAlgorithms = options && (0,_lib_validate_algorithms_js__WEBPACK_IMPORTED_MODULE_10__["default"])('keyManagementAlgorithms', options.keyManagementAlgorithms);
    const contentEncryptionAlgorithms = options &&
        (0,_lib_validate_algorithms_js__WEBPACK_IMPORTED_MODULE_10__["default"])('contentEncryptionAlgorithms', options.contentEncryptionAlgorithms);
    if (keyManagementAlgorithms && !keyManagementAlgorithms.has(alg)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter not allowed');
    }
    if (contentEncryptionAlgorithms && !contentEncryptionAlgorithms.has(enc)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSEAlgNotAllowed('"enc" (Encryption Algorithm) Header Parameter not allowed');
    }
    let encryptedKey;
    if (jwe.encrypted_key !== undefined) {
        encryptedKey = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.encrypted_key);
    }
    let resolvedKey = false;
    if (typeof key === 'function') {
        key = await key(parsedProt, jwe);
        resolvedKey = true;
    }
    let cek;
    try {
        cek = await (0,_lib_decrypt_key_management_js__WEBPACK_IMPORTED_MODULE_6__["default"])(alg, key, encryptedKey, joseHeader, options);
    }
    catch (err) {
        if (err instanceof TypeError || err instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWEInvalid || err instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSENotSupported) {
            throw err;
        }
        cek = (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_8__["default"])(enc);
    }
    const iv = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.iv);
    const tag = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.tag);
    const protectedHeader = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode((_a = jwe.protected) !== null && _a !== void 0 ? _a : '');
    let additionalData;
    if (jwe.aad !== undefined) {
        additionalData = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.concat)(protectedHeader, _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode('.'), _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode(jwe.aad));
    }
    else {
        additionalData = protectedHeader;
    }
    let plaintext = await (0,_runtime_decrypt_js__WEBPACK_IMPORTED_MODULE_1__["default"])(enc, cek, (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.ciphertext), iv, tag, additionalData);
    if (joseHeader.zip === 'DEF') {
        plaintext = await ((options === null || options === void 0 ? void 0 : options.inflateRaw) || _runtime_zlib_js__WEBPACK_IMPORTED_MODULE_2__.inflate)(plaintext);
    }
    const result = { plaintext };
    if (jwe.protected !== undefined) {
        result.protectedHeader = parsedProt;
    }
    if (jwe.aad !== undefined) {
        result.additionalAuthenticatedData = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwe.aad);
    }
    if (jwe.unprotected !== undefined) {
        result.sharedUnprotectedHeader = jwe.unprotected;
    }
    if (jwe.header !== undefined) {
        result.unprotectedHeader = jwe.header;
    }
    if (resolvedKey) {
        return { ...result, key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/flattened/encrypt.js":
/*!***********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/flattened/encrypt.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlattenedEncrypt": () => (/* binding */ FlattenedEncrypt),
/* harmony export */   "unprotected": () => (/* binding */ unprotected)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _runtime_encrypt_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../runtime/encrypt.js */ "../core/node_modules/jose/dist/browser/runtime/encrypt.js");
/* harmony import */ var _runtime_zlib_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../runtime/zlib.js */ "../core/node_modules/jose/dist/browser/runtime/zlib.js");
/* harmony import */ var _lib_iv_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../lib/iv.js */ "../core/node_modules/jose/dist/browser/lib/iv.js");
/* harmony import */ var _lib_encrypt_key_management_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/encrypt_key_management.js */ "../core/node_modules/jose/dist/browser/lib/encrypt_key_management.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../lib/is_disjoint.js */ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../lib/validate_crit.js */ "../core/node_modules/jose/dist/browser/lib/validate_crit.js");









const unprotected = Symbol();
class FlattenedEncrypt {
    constructor(plaintext) {
        if (!(plaintext instanceof Uint8Array)) {
            throw new TypeError('plaintext must be an instance of Uint8Array');
        }
        this._plaintext = plaintext;
    }
    setKeyManagementParameters(parameters) {
        if (this._keyManagementParameters) {
            throw new TypeError('setKeyManagementParameters can only be called once');
        }
        this._keyManagementParameters = parameters;
        return this;
    }
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setSharedUnprotectedHeader(sharedUnprotectedHeader) {
        if (this._sharedUnprotectedHeader) {
            throw new TypeError('setSharedUnprotectedHeader can only be called once');
        }
        this._sharedUnprotectedHeader = sharedUnprotectedHeader;
        return this;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this._unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this._unprotectedHeader = unprotectedHeader;
        return this;
    }
    setAdditionalAuthenticatedData(aad) {
        this._aad = aad;
        return this;
    }
    setContentEncryptionKey(cek) {
        if (this._cek) {
            throw new TypeError('setContentEncryptionKey can only be called once');
        }
        this._cek = cek;
        return this;
    }
    setInitializationVector(iv) {
        if (this._iv) {
            throw new TypeError('setInitializationVector can only be called once');
        }
        this._iv = iv;
        return this;
    }
    async encrypt(key, options) {
        if (!this._protectedHeader && !this._unprotectedHeader && !this._sharedUnprotectedHeader) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('either setProtectedHeader, setUnprotectedHeader, or sharedUnprotectedHeader must be called before #encrypt()');
        }
        if (!(0,_lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_6__["default"])(this._protectedHeader, this._unprotectedHeader, this._sharedUnprotectedHeader)) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint');
        }
        const joseHeader = {
            ...this._protectedHeader,
            ...this._unprotectedHeader,
            ...this._sharedUnprotectedHeader,
        };
        (0,_lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_8__["default"])(_util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid, new Map(), options === null || options === void 0 ? void 0 : options.crit, this._protectedHeader, joseHeader);
        if (joseHeader.zip !== undefined) {
            if (!this._protectedHeader || !this._protectedHeader.zip) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
            }
            if (joseHeader.zip !== 'DEF') {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JOSENotSupported('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value');
            }
        }
        const { alg, enc } = joseHeader;
        if (typeof alg !== 'string' || !alg) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE "alg" (Algorithm) Header Parameter missing or invalid');
        }
        if (typeof enc !== 'string' || !enc) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
        }
        let encryptedKey;
        if (alg === 'dir') {
            if (this._cek) {
                throw new TypeError('setContentEncryptionKey cannot be called when using Direct Encryption');
            }
        }
        else if (alg === 'ECDH-ES') {
            if (this._cek) {
                throw new TypeError('setContentEncryptionKey cannot be called when using Direct Key Agreement');
            }
        }
        let cek;
        {
            let parameters;
            ({ cek, encryptedKey, parameters } = await (0,_lib_encrypt_key_management_js__WEBPACK_IMPORTED_MODULE_4__["default"])(alg, enc, key, this._cek, this._keyManagementParameters));
            if (parameters) {
                if (options && unprotected in options) {
                    if (!this._unprotectedHeader) {
                        this.setUnprotectedHeader(parameters);
                    }
                    else {
                        this._unprotectedHeader = { ...this._unprotectedHeader, ...parameters };
                    }
                }
                else {
                    if (!this._protectedHeader) {
                        this.setProtectedHeader(parameters);
                    }
                    else {
                        this._protectedHeader = { ...this._protectedHeader, ...parameters };
                    }
                }
            }
        }
        this._iv || (this._iv = (0,_lib_iv_js__WEBPACK_IMPORTED_MODULE_3__["default"])(enc));
        let additionalData;
        let protectedHeader;
        let aadMember;
        if (this._protectedHeader) {
            protectedHeader = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode((0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(JSON.stringify(this._protectedHeader)));
        }
        else {
            protectedHeader = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode('');
        }
        if (this._aad) {
            aadMember = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(this._aad);
            additionalData = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.concat)(protectedHeader, _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode('.'), _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.encoder.encode(aadMember));
        }
        else {
            additionalData = protectedHeader;
        }
        let ciphertext;
        let tag;
        if (joseHeader.zip === 'DEF') {
            const deflated = await ((options === null || options === void 0 ? void 0 : options.deflateRaw) || _runtime_zlib_js__WEBPACK_IMPORTED_MODULE_2__.deflate)(this._plaintext);
            ({ ciphertext, tag } = await (0,_runtime_encrypt_js__WEBPACK_IMPORTED_MODULE_1__["default"])(enc, deflated, cek, this._iv, additionalData));
        }
        else {
            ;
            ({ ciphertext, tag } = await (0,_runtime_encrypt_js__WEBPACK_IMPORTED_MODULE_1__["default"])(enc, this._plaintext, cek, this._iv, additionalData));
        }
        const jwe = {
            ciphertext: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(ciphertext),
            iv: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(this._iv),
            tag: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(tag),
        };
        if (encryptedKey) {
            jwe.encrypted_key = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(encryptedKey);
        }
        if (aadMember) {
            jwe.aad = aadMember;
        }
        if (this._protectedHeader) {
            jwe.protected = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_7__.decoder.decode(protectedHeader);
        }
        if (this._sharedUnprotectedHeader) {
            jwe.unprotected = this._sharedUnprotectedHeader;
        }
        if (this._unprotectedHeader) {
            jwe.header = this._unprotectedHeader;
        }
        return jwe;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/general/decrypt.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/general/decrypt.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generalDecrypt": () => (/* binding */ generalDecrypt)
/* harmony export */ });
/* harmony import */ var _flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/decrypt.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");



async function generalDecrypt(jwe, key, options) {
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])(jwe)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('General JWE must be an object');
    }
    if (!Array.isArray(jwe.recipients) || !jwe.recipients.every(_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE Recipients missing or incorrect type');
    }
    if (!jwe.recipients.length) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE Recipients has no members');
    }
    for (const recipient of jwe.recipients) {
        try {
            return await (0,_flattened_decrypt_js__WEBPACK_IMPORTED_MODULE_0__.flattenedDecrypt)({
                aad: jwe.aad,
                ciphertext: jwe.ciphertext,
                encrypted_key: recipient.encrypted_key,
                header: recipient.header,
                iv: jwe.iv,
                protected: jwe.protected,
                tag: jwe.tag,
                unprotected: jwe.unprotected,
            }, key, options);
        }
        catch (_a) {
        }
    }
    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEDecryptionFailed();
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwe/general/encrypt.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwe/general/encrypt.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GeneralEncrypt": () => (/* binding */ GeneralEncrypt)
/* harmony export */ });
/* harmony import */ var _flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/flattened/encrypt.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_cek_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/cek.js */ "../core/node_modules/jose/dist/browser/lib/cek.js");
/* harmony import */ var _lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../lib/is_disjoint.js */ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js");
/* harmony import */ var _lib_encrypt_key_management_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/encrypt_key_management.js */ "../core/node_modules/jose/dist/browser/lib/encrypt_key_management.js");
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../lib/validate_crit.js */ "../core/node_modules/jose/dist/browser/lib/validate_crit.js");







class IndividualRecipient {
    constructor(enc, key, options) {
        this.parent = enc;
        this.key = key;
        this.options = options;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this.unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this.unprotectedHeader = unprotectedHeader;
        return this;
    }
    addRecipient(...args) {
        return this.parent.addRecipient(...args);
    }
    encrypt(...args) {
        return this.parent.encrypt(...args);
    }
    done() {
        return this.parent;
    }
}
class GeneralEncrypt {
    constructor(plaintext) {
        this._recipients = [];
        this._plaintext = plaintext;
    }
    addRecipient(key, options) {
        const recipient = new IndividualRecipient(this, key, { crit: options === null || options === void 0 ? void 0 : options.crit });
        this._recipients.push(recipient);
        return recipient;
    }
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setSharedUnprotectedHeader(sharedUnprotectedHeader) {
        if (this._unprotectedHeader) {
            throw new TypeError('setSharedUnprotectedHeader can only be called once');
        }
        this._unprotectedHeader = sharedUnprotectedHeader;
        return this;
    }
    setAdditionalAuthenticatedData(aad) {
        this._aad = aad;
        return this;
    }
    async encrypt(options) {
        var _a, _b, _c;
        if (!this._recipients.length) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('at least one recipient must be added');
        }
        options = { deflateRaw: options === null || options === void 0 ? void 0 : options.deflateRaw };
        if (this._recipients.length === 1) {
            const [recipient] = this._recipients;
            const flattened = await new _flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__.FlattenedEncrypt(this._plaintext)
                .setAdditionalAuthenticatedData(this._aad)
                .setProtectedHeader(this._protectedHeader)
                .setSharedUnprotectedHeader(this._unprotectedHeader)
                .setUnprotectedHeader(recipient.unprotectedHeader)
                .encrypt(recipient.key, { ...recipient.options, ...options });
            let jwe = {
                ciphertext: flattened.ciphertext,
                iv: flattened.iv,
                recipients: [{}],
                tag: flattened.tag,
            };
            if (flattened.aad)
                jwe.aad = flattened.aad;
            if (flattened.protected)
                jwe.protected = flattened.protected;
            if (flattened.unprotected)
                jwe.unprotected = flattened.unprotected;
            if (flattened.encrypted_key)
                jwe.recipients[0].encrypted_key = flattened.encrypted_key;
            if (flattened.header)
                jwe.recipients[0].header = flattened.header;
            return jwe;
        }
        let enc;
        for (let i = 0; i < this._recipients.length; i++) {
            const recipient = this._recipients[i];
            if (!(0,_lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_3__["default"])(this._protectedHeader, this._unprotectedHeader, recipient.unprotectedHeader)) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint');
            }
            const joseHeader = {
                ...this._protectedHeader,
                ...this._unprotectedHeader,
                ...recipient.unprotectedHeader,
            };
            const { alg } = joseHeader;
            if (typeof alg !== 'string' || !alg) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE "alg" (Algorithm) Header Parameter missing or invalid');
            }
            if (alg === 'dir' || alg === 'ECDH-ES') {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('"dir" and "ECDH-ES" alg may only be used with a single recipient');
            }
            if (typeof joseHeader.enc !== 'string' || !joseHeader.enc) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
            }
            if (!enc) {
                enc = joseHeader.enc;
            }
            else if (enc !== joseHeader.enc) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter must be the same for all recipients');
            }
            (0,_lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_6__["default"])(_util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid, new Map(), recipient.options.crit, this._protectedHeader, joseHeader);
            if (joseHeader.zip !== undefined) {
                if (!this._protectedHeader || !this._protectedHeader.zip) {
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWEInvalid('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
                }
            }
        }
        const cek = (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_2__["default"])(enc);
        let jwe = {
            ciphertext: '',
            iv: '',
            recipients: [],
            tag: '',
        };
        for (let i = 0; i < this._recipients.length; i++) {
            const recipient = this._recipients[i];
            const target = {};
            jwe.recipients.push(target);
            const joseHeader = {
                ...this._protectedHeader,
                ...this._unprotectedHeader,
                ...recipient.unprotectedHeader,
            };
            const p2c = joseHeader.alg.startsWith('PBES2') ? 2048 + i : undefined;
            if (i === 0) {
                const flattened = await new _flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__.FlattenedEncrypt(this._plaintext)
                    .setAdditionalAuthenticatedData(this._aad)
                    .setContentEncryptionKey(cek)
                    .setProtectedHeader(this._protectedHeader)
                    .setSharedUnprotectedHeader(this._unprotectedHeader)
                    .setUnprotectedHeader(recipient.unprotectedHeader)
                    .setKeyManagementParameters({ p2c })
                    .encrypt(recipient.key, {
                    ...recipient.options,
                    ...options,
                    [_flattened_encrypt_js__WEBPACK_IMPORTED_MODULE_0__.unprotected]: true,
                });
                jwe.ciphertext = flattened.ciphertext;
                jwe.iv = flattened.iv;
                jwe.tag = flattened.tag;
                if (flattened.aad)
                    jwe.aad = flattened.aad;
                if (flattened.protected)
                    jwe.protected = flattened.protected;
                if (flattened.unprotected)
                    jwe.unprotected = flattened.unprotected;
                target.encrypted_key = flattened.encrypted_key;
                if (flattened.header)
                    target.header = flattened.header;
                continue;
            }
            const { encryptedKey, parameters } = await (0,_lib_encrypt_key_management_js__WEBPACK_IMPORTED_MODULE_4__["default"])(((_a = recipient.unprotectedHeader) === null || _a === void 0 ? void 0 : _a.alg) ||
                ((_b = this._protectedHeader) === null || _b === void 0 ? void 0 : _b.alg) ||
                ((_c = this._unprotectedHeader) === null || _c === void 0 ? void 0 : _c.alg), enc, recipient.key, cek, { p2c });
            target.encrypted_key = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_5__.encode)(encryptedKey);
            if (recipient.unprotectedHeader || parameters)
                target.header = { ...recipient.unprotectedHeader, ...parameters };
        }
        return jwe;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwk/embedded.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwk/embedded.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EmbeddedJWK": () => (/* binding */ EmbeddedJWK)
/* harmony export */ });
/* harmony import */ var _key_import_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../key/import.js */ "../core/node_modules/jose/dist/browser/key/import.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");



async function EmbeddedJWK(protectedHeader, token) {
    const joseHeader = {
        ...protectedHeader,
        ...token === null || token === void 0 ? void 0 : token.header,
    };
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_1__["default"])(joseHeader.jwk)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('"jwk" (JSON Web Key) Header Parameter must be a JSON object');
    }
    const key = await (0,_key_import_js__WEBPACK_IMPORTED_MODULE_0__.importJWK)({ ...joseHeader.jwk, ext: true }, joseHeader.alg, true);
    if (key instanceof Uint8Array || key.type !== 'public') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('"jwk" (JSON Web Key) Header Parameter must be a public key');
    }
    return key;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwk/thumbprint.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwk/thumbprint.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "calculateJwkThumbprint": () => (/* binding */ calculateJwkThumbprint),
/* harmony export */   "calculateJwkThumbprintUri": () => (/* binding */ calculateJwkThumbprintUri)
/* harmony export */ });
/* harmony import */ var _runtime_digest_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/digest.js */ "../core/node_modules/jose/dist/browser/runtime/digest.js");
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");





const check = (value, description) => {
    if (typeof value !== 'string' || !value) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWKInvalid(`${description} missing or invalid`);
    }
};
async function calculateJwkThumbprint(jwk, digestAlgorithm) {
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_4__["default"])(jwk)) {
        throw new TypeError('JWK must be an object');
    }
    digestAlgorithm !== null && digestAlgorithm !== void 0 ? digestAlgorithm : (digestAlgorithm = 'sha256');
    if (digestAlgorithm !== 'sha256' &&
        digestAlgorithm !== 'sha384' &&
        digestAlgorithm !== 'sha512') {
        throw new TypeError('digestAlgorithm must one of "sha256", "sha384", or "sha512"');
    }
    let components;
    switch (jwk.kty) {
        case 'EC':
            check(jwk.crv, '"crv" (Curve) Parameter');
            check(jwk.x, '"x" (X Coordinate) Parameter');
            check(jwk.y, '"y" (Y Coordinate) Parameter');
            components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
            break;
        case 'OKP':
            check(jwk.crv, '"crv" (Subtype of Key Pair) Parameter');
            check(jwk.x, '"x" (Public Key) Parameter');
            components = { crv: jwk.crv, kty: jwk.kty, x: jwk.x };
            break;
        case 'RSA':
            check(jwk.e, '"e" (Exponent) Parameter');
            check(jwk.n, '"n" (Modulus) Parameter');
            components = { e: jwk.e, kty: jwk.kty, n: jwk.n };
            break;
        case 'oct':
            check(jwk.k, '"k" (Key Value) Parameter');
            components = { k: jwk.k, kty: jwk.kty };
            break;
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('"kty" (Key Type) Parameter missing or unsupported');
    }
    const data = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.encoder.encode(JSON.stringify(components));
    return (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_1__.encode)(await (0,_runtime_digest_js__WEBPACK_IMPORTED_MODULE_0__["default"])(digestAlgorithm, data));
}
async function calculateJwkThumbprintUri(jwk, digestAlgorithm) {
    digestAlgorithm !== null && digestAlgorithm !== void 0 ? digestAlgorithm : (digestAlgorithm = 'sha256');
    const thumbprint = await calculateJwkThumbprint(jwk, digestAlgorithm);
    return `urn:ietf:params:oauth:jwk-thumbprint:sha-${digestAlgorithm.slice(-3)}:${thumbprint}`;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwks/local.js":
/*!************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwks/local.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LocalJWKSet": () => (/* binding */ LocalJWKSet),
/* harmony export */   "createLocalJWKSet": () => (/* binding */ createLocalJWKSet),
/* harmony export */   "isJWKSLike": () => (/* binding */ isJWKSLike)
/* harmony export */ });
/* harmony import */ var _key_import_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../key/import.js */ "../core/node_modules/jose/dist/browser/key/import.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");



function getKtyFromAlg(alg) {
    switch (typeof alg === 'string' && alg.slice(0, 2)) {
        case 'RS':
        case 'PS':
            return 'RSA';
        case 'ES':
            return 'EC';
        case 'Ed':
            return 'OKP';
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
    }
}
function isJWKSLike(jwks) {
    return (jwks &&
        typeof jwks === 'object' &&
        Array.isArray(jwks.keys) &&
        jwks.keys.every(isJWKLike));
}
function isJWKLike(key) {
    return (0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])(key);
}
function clone(obj) {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
}
class LocalJWKSet {
    constructor(jwks) {
        this._cached = new WeakMap();
        if (!isJWKSLike(jwks)) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWKSInvalid('JSON Web Key Set malformed');
        }
        this._jwks = clone(jwks);
    }
    async getKey(protectedHeader, token) {
        const { alg, kid } = { ...protectedHeader, ...token === null || token === void 0 ? void 0 : token.header };
        const kty = getKtyFromAlg(alg);
        const candidates = this._jwks.keys.filter((jwk) => {
            let candidate = kty === jwk.kty;
            if (candidate && typeof kid === 'string') {
                candidate = kid === jwk.kid;
            }
            if (candidate && typeof jwk.alg === 'string') {
                candidate = alg === jwk.alg;
            }
            if (candidate && typeof jwk.use === 'string') {
                candidate = jwk.use === 'sig';
            }
            if (candidate && Array.isArray(jwk.key_ops)) {
                candidate = jwk.key_ops.includes('verify');
            }
            if (candidate && alg === 'EdDSA') {
                candidate = jwk.crv === 'Ed25519' || jwk.crv === 'Ed448';
            }
            if (candidate) {
                switch (alg) {
                    case 'ES256':
                        candidate = jwk.crv === 'P-256';
                        break;
                    case 'ES256K':
                        candidate = jwk.crv === 'secp256k1';
                        break;
                    case 'ES384':
                        candidate = jwk.crv === 'P-384';
                        break;
                    case 'ES512':
                        candidate = jwk.crv === 'P-521';
                        break;
                }
            }
            return candidate;
        });
        const { 0: jwk, length } = candidates;
        if (length === 0) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWKSNoMatchingKey();
        }
        else if (length !== 1) {
            const error = new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWKSMultipleMatchingKeys();
            const { _cached } = this;
            error[Symbol.asyncIterator] = async function* () {
                for (const jwk of candidates) {
                    try {
                        yield await importWithAlgCache(_cached, jwk, alg);
                    }
                    catch (_a) {
                        continue;
                    }
                }
            };
            throw error;
        }
        return importWithAlgCache(this._cached, jwk, alg);
    }
}
async function importWithAlgCache(cache, jwk, alg) {
    const cached = cache.get(jwk) || cache.set(jwk, {}).get(jwk);
    if (cached[alg] === undefined) {
        const key = await (0,_key_import_js__WEBPACK_IMPORTED_MODULE_0__.importJWK)({ ...jwk, ext: true }, alg);
        if (key instanceof Uint8Array || key.type !== 'public') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWKSInvalid('JSON Web Key Set members must be public keys');
        }
        cached[alg] = key;
    }
    return cached[alg];
}
function createLocalJWKSet(jwks) {
    const set = new LocalJWKSet(jwks);
    return async function (protectedHeader, token) {
        return set.getKey(protectedHeader, token);
    };
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwks/remote.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwks/remote.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createRemoteJWKSet": () => (/* binding */ createRemoteJWKSet)
/* harmony export */ });
/* harmony import */ var _runtime_fetch_jwks_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/fetch_jwks.js */ "../core/node_modules/jose/dist/browser/runtime/fetch_jwks.js");
/* harmony import */ var _runtime_env_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _local_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./local.js */ "../core/node_modules/jose/dist/browser/jwks/local.js");




class RemoteJWKSet extends _local_js__WEBPACK_IMPORTED_MODULE_3__.LocalJWKSet {
    constructor(url, options) {
        super({ keys: [] });
        this._jwks = undefined;
        if (!(url instanceof URL)) {
            throw new TypeError('url must be an instance of URL');
        }
        this._url = new URL(url.href);
        this._options = { agent: options === null || options === void 0 ? void 0 : options.agent, headers: options === null || options === void 0 ? void 0 : options.headers };
        this._timeoutDuration =
            typeof (options === null || options === void 0 ? void 0 : options.timeoutDuration) === 'number' ? options === null || options === void 0 ? void 0 : options.timeoutDuration : 5000;
        this._cooldownDuration =
            typeof (options === null || options === void 0 ? void 0 : options.cooldownDuration) === 'number' ? options === null || options === void 0 ? void 0 : options.cooldownDuration : 30000;
        this._cacheMaxAge = typeof (options === null || options === void 0 ? void 0 : options.cacheMaxAge) === 'number' ? options === null || options === void 0 ? void 0 : options.cacheMaxAge : 600000;
    }
    coolingDown() {
        return typeof this._jwksTimestamp === 'number'
            ? Date.now() < this._jwksTimestamp + this._cooldownDuration
            : false;
    }
    fresh() {
        return typeof this._jwksTimestamp === 'number'
            ? Date.now() < this._jwksTimestamp + this._cacheMaxAge
            : false;
    }
    async getKey(protectedHeader, token) {
        if (!this._jwks || !this.fresh()) {
            await this.reload();
        }
        try {
            return await super.getKey(protectedHeader, token);
        }
        catch (err) {
            if (err instanceof _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWKSNoMatchingKey) {
                if (this.coolingDown() === false) {
                    await this.reload();
                    return super.getKey(protectedHeader, token);
                }
            }
            throw err;
        }
    }
    async reload() {
        if (this._pendingFetch && (0,_runtime_env_js__WEBPACK_IMPORTED_MODULE_1__.isCloudflareWorkers)()) {
            this._pendingFetch = undefined;
        }
        this._pendingFetch || (this._pendingFetch = (0,_runtime_fetch_jwks_js__WEBPACK_IMPORTED_MODULE_0__["default"])(this._url, this._timeoutDuration, this._options)
            .then((json) => {
            if (!(0,_local_js__WEBPACK_IMPORTED_MODULE_3__.isJWKSLike)(json)) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWKSInvalid('JSON Web Key Set malformed');
            }
            this._jwks = { keys: json.keys };
            this._jwksTimestamp = Date.now();
            this._pendingFetch = undefined;
        })
            .catch((err) => {
            this._pendingFetch = undefined;
            throw err;
        }));
        await this._pendingFetch;
    }
}
function createRemoteJWKSet(url, options) {
    const set = new RemoteJWKSet(url, options);
    return async function (protectedHeader, token) {
        return set.getKey(protectedHeader, token);
    };
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/compact/sign.js":
/*!******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/compact/sign.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CompactSign": () => (/* binding */ CompactSign)
/* harmony export */ });
/* harmony import */ var _flattened_sign_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/sign.js */ "../core/node_modules/jose/dist/browser/jws/flattened/sign.js");

class CompactSign {
    constructor(payload) {
        this._flattened = new _flattened_sign_js__WEBPACK_IMPORTED_MODULE_0__.FlattenedSign(payload);
    }
    setProtectedHeader(protectedHeader) {
        this._flattened.setProtectedHeader(protectedHeader);
        return this;
    }
    async sign(key, options) {
        const jws = await this._flattened.sign(key, options);
        if (jws.payload === undefined) {
            throw new TypeError('use the flattened module for creating JWS with b64: false');
        }
        return `${jws.protected}.${jws.payload}.${jws.signature}`;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/compact/verify.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/compact/verify.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "compactVerify": () => (/* binding */ compactVerify)
/* harmony export */ });
/* harmony import */ var _flattened_verify_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/verify.js */ "../core/node_modules/jose/dist/browser/jws/flattened/verify.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");



async function compactVerify(jws, key, options) {
    if (jws instanceof Uint8Array) {
        jws = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__.decoder.decode(jws);
    }
    if (typeof jws !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('Compact JWS must be a string or Uint8Array');
    }
    const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split('.');
    if (length !== 3) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('Invalid Compact JWS');
    }
    const verified = await (0,_flattened_verify_js__WEBPACK_IMPORTED_MODULE_0__.flattenedVerify)({ payload, protected: protectedHeader, signature }, key, options);
    const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
    if (typeof key === 'function') {
        return { ...result, key: verified.key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/flattened/sign.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/flattened/sign.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlattenedSign": () => (/* binding */ FlattenedSign)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _runtime_sign_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../runtime/sign.js */ "../core/node_modules/jose/dist/browser/runtime/sign.js");
/* harmony import */ var _lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/is_disjoint.js */ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_check_key_type_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../lib/check_key_type.js */ "../core/node_modules/jose/dist/browser/lib/check_key_type.js");
/* harmony import */ var _lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../lib/validate_crit.js */ "../core/node_modules/jose/dist/browser/lib/validate_crit.js");







class FlattenedSign {
    constructor(payload) {
        if (!(payload instanceof Uint8Array)) {
            throw new TypeError('payload must be an instance of Uint8Array');
        }
        this._payload = payload;
    }
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this._unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this._unprotectedHeader = unprotectedHeader;
        return this;
    }
    async sign(key, options) {
        if (!this._protectedHeader && !this._unprotectedHeader) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWSInvalid('either setProtectedHeader or setUnprotectedHeader must be called before #sign()');
        }
        if (!(0,_lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_2__["default"])(this._protectedHeader, this._unprotectedHeader)) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWSInvalid('JWS Protected and JWS Unprotected Header Parameter names must be disjoint');
        }
        const joseHeader = {
            ...this._protectedHeader,
            ...this._unprotectedHeader,
        };
        const extensions = (0,_lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_6__["default"])(_util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWSInvalid, new Map([['b64', true]]), options === null || options === void 0 ? void 0 : options.crit, this._protectedHeader, joseHeader);
        let b64 = true;
        if (extensions.has('b64')) {
            b64 = this._protectedHeader.b64;
            if (typeof b64 !== 'boolean') {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
            }
        }
        const { alg } = joseHeader;
        if (typeof alg !== 'string' || !alg) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
        }
        (0,_lib_check_key_type_js__WEBPACK_IMPORTED_MODULE_5__["default"])(alg, key, 'sign');
        let payload = this._payload;
        if (b64) {
            payload = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.encoder.encode((0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(payload));
        }
        let protectedHeader;
        if (this._protectedHeader) {
            protectedHeader = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.encoder.encode((0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(JSON.stringify(this._protectedHeader)));
        }
        else {
            protectedHeader = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.encoder.encode('');
        }
        const data = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.concat)(protectedHeader, _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.encoder.encode('.'), payload);
        const signature = await (0,_runtime_sign_js__WEBPACK_IMPORTED_MODULE_1__["default"])(alg, key, data);
        const jws = {
            signature: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode)(signature),
            payload: '',
        };
        if (b64) {
            jws.payload = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.decoder.decode(payload);
        }
        if (this._unprotectedHeader) {
            jws.header = this._unprotectedHeader;
        }
        if (this._protectedHeader) {
            jws.protected = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_4__.decoder.decode(protectedHeader);
        }
        return jws;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/flattened/verify.js":
/*!**********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/flattened/verify.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flattenedVerify": () => (/* binding */ flattenedVerify)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _runtime_verify_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../runtime/verify.js */ "../core/node_modules/jose/dist/browser/runtime/verify.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../lib/is_disjoint.js */ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _lib_check_key_type_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../lib/check_key_type.js */ "../core/node_modules/jose/dist/browser/lib/check_key_type.js");
/* harmony import */ var _lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../lib/validate_crit.js */ "../core/node_modules/jose/dist/browser/lib/validate_crit.js");
/* harmony import */ var _lib_validate_algorithms_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../lib/validate_algorithms.js */ "../core/node_modules/jose/dist/browser/lib/validate_algorithms.js");









async function flattenedVerify(jws, key, options) {
    var _a;
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__["default"])(jws)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('Flattened JWS must be an object');
    }
    if (jws.protected === undefined && jws.header === undefined) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
    }
    if (jws.protected !== undefined && typeof jws.protected !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Protected Header incorrect type');
    }
    if (jws.payload === undefined) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Payload missing');
    }
    if (typeof jws.signature !== 'string') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Signature missing or incorrect type');
    }
    if (jws.header !== undefined && !(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_5__["default"])(jws.header)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Unprotected Header incorrect type');
    }
    let parsedProt = {};
    if (jws.protected) {
        try {
            const protectedHeader = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jws.protected);
            parsedProt = JSON.parse(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.decoder.decode(protectedHeader));
        }
        catch (_b) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Protected Header is invalid');
        }
    }
    if (!(0,_lib_is_disjoint_js__WEBPACK_IMPORTED_MODULE_4__["default"])(parsedProt, jws.header)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Protected and JWS Unprotected Header Parameter names must be disjoint');
    }
    const joseHeader = {
        ...parsedProt,
        ...jws.header,
    };
    const extensions = (0,_lib_validate_crit_js__WEBPACK_IMPORTED_MODULE_7__["default"])(_util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid, new Map([['b64', true]]), options === null || options === void 0 ? void 0 : options.crit, parsedProt, joseHeader);
    let b64 = true;
    if (extensions.has('b64')) {
        b64 = parsedProt.b64;
        if (typeof b64 !== 'boolean') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
        }
    }
    const { alg } = joseHeader;
    if (typeof alg !== 'string' || !alg) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    const algorithms = options && (0,_lib_validate_algorithms_js__WEBPACK_IMPORTED_MODULE_8__["default"])('algorithms', options.algorithms);
    if (algorithms && !algorithms.has(alg)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter not allowed');
    }
    if (b64) {
        if (typeof jws.payload !== 'string') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Payload must be a string');
        }
    }
    else if (typeof jws.payload !== 'string' && !(jws.payload instanceof Uint8Array)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSInvalid('JWS Payload must be a string or an Uint8Array instance');
    }
    let resolvedKey = false;
    if (typeof key === 'function') {
        key = await key(parsedProt, jws);
        resolvedKey = true;
    }
    (0,_lib_check_key_type_js__WEBPACK_IMPORTED_MODULE_6__["default"])(alg, key, 'verify');
    const data = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.concat)(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.encoder.encode((_a = jws.protected) !== null && _a !== void 0 ? _a : ''), _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.encoder.encode('.'), typeof jws.payload === 'string' ? _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.encoder.encode(jws.payload) : jws.payload);
    const signature = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jws.signature);
    const verified = await (0,_runtime_verify_js__WEBPACK_IMPORTED_MODULE_1__["default"])(alg, key, signature, data);
    if (!verified) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWSSignatureVerificationFailed();
    }
    let payload;
    if (b64) {
        payload = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jws.payload);
    }
    else if (typeof jws.payload === 'string') {
        payload = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_3__.encoder.encode(jws.payload);
    }
    else {
        payload = jws.payload;
    }
    const result = { payload };
    if (jws.protected !== undefined) {
        result.protectedHeader = parsedProt;
    }
    if (jws.header !== undefined) {
        result.unprotectedHeader = jws.header;
    }
    if (resolvedKey) {
        return { ...result, key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/general/sign.js":
/*!******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/general/sign.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GeneralSign": () => (/* binding */ GeneralSign)
/* harmony export */ });
/* harmony import */ var _flattened_sign_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/sign.js */ "../core/node_modules/jose/dist/browser/jws/flattened/sign.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");


class IndividualSignature {
    constructor(sig, key, options) {
        this.parent = sig;
        this.key = key;
        this.options = options;
    }
    setProtectedHeader(protectedHeader) {
        if (this.protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this.protectedHeader = protectedHeader;
        return this;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this.unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this.unprotectedHeader = unprotectedHeader;
        return this;
    }
    addSignature(...args) {
        return this.parent.addSignature(...args);
    }
    sign(...args) {
        return this.parent.sign(...args);
    }
    done() {
        return this.parent;
    }
}
class GeneralSign {
    constructor(payload) {
        this._signatures = [];
        this._payload = payload;
    }
    addSignature(key, options) {
        const signature = new IndividualSignature(this, key, options);
        this._signatures.push(signature);
        return signature;
    }
    async sign() {
        if (!this._signatures.length) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('at least one signature must be added');
        }
        const jws = {
            signatures: [],
            payload: '',
        };
        for (let i = 0; i < this._signatures.length; i++) {
            const signature = this._signatures[i];
            const flattened = new _flattened_sign_js__WEBPACK_IMPORTED_MODULE_0__.FlattenedSign(this._payload);
            flattened.setProtectedHeader(signature.protectedHeader);
            flattened.setUnprotectedHeader(signature.unprotectedHeader);
            const { payload, ...rest } = await flattened.sign(signature.key, signature.options);
            if (i === 0) {
                jws.payload = payload;
            }
            else if (jws.payload !== payload) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('inconsistent use of JWS Unencoded Payload (RFC7797)');
            }
            jws.signatures.push(rest);
        }
        return jws;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jws/general/verify.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jws/general/verify.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generalVerify": () => (/* binding */ generalVerify)
/* harmony export */ });
/* harmony import */ var _flattened_verify_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../flattened/verify.js */ "../core/node_modules/jose/dist/browser/jws/flattened/verify.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");



async function generalVerify(jws, key, options) {
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])(jws)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('General JWS must be an object');
    }
    if (!Array.isArray(jws.signatures) || !jws.signatures.every(_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSInvalid('JWS Signatures missing or incorrect type');
    }
    for (const signature of jws.signatures) {
        try {
            return await (0,_flattened_verify_js__WEBPACK_IMPORTED_MODULE_0__.flattenedVerify)({
                header: signature.header,
                payload: jws.payload,
                protected: signature.protected,
                signature: signature.signature,
            }, key, options);
        }
        catch (_a) {
        }
    }
    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWSSignatureVerificationFailed();
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/decrypt.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/decrypt.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "jwtDecrypt": () => (/* binding */ jwtDecrypt)
/* harmony export */ });
/* harmony import */ var _jwe_compact_decrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../jwe/compact/decrypt.js */ "../core/node_modules/jose/dist/browser/jwe/compact/decrypt.js");
/* harmony import */ var _lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/jwt_claims_set.js */ "../core/node_modules/jose/dist/browser/lib/jwt_claims_set.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");



async function jwtDecrypt(jwt, key, options) {
    const decrypted = await (0,_jwe_compact_decrypt_js__WEBPACK_IMPORTED_MODULE_0__.compactDecrypt)(jwt, key, options);
    const payload = (0,_lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_1__["default"])(decrypted.protectedHeader, decrypted.plaintext, options);
    const { protectedHeader } = decrypted;
    if (protectedHeader.iss !== undefined && protectedHeader.iss !== payload.iss) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTClaimValidationFailed('replicated "iss" claim header parameter mismatch', 'iss', 'mismatch');
    }
    if (protectedHeader.sub !== undefined && protectedHeader.sub !== payload.sub) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTClaimValidationFailed('replicated "sub" claim header parameter mismatch', 'sub', 'mismatch');
    }
    if (protectedHeader.aud !== undefined &&
        JSON.stringify(protectedHeader.aud) !== JSON.stringify(payload.aud)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTClaimValidationFailed('replicated "aud" claim header parameter mismatch', 'aud', 'mismatch');
    }
    const result = { payload, protectedHeader };
    if (typeof key === 'function') {
        return { ...result, key: decrypted.key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/encrypt.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/encrypt.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EncryptJWT": () => (/* binding */ EncryptJWT)
/* harmony export */ });
/* harmony import */ var _jwe_compact_encrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../jwe/compact/encrypt.js */ "../core/node_modules/jose/dist/browser/jwe/compact/encrypt.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _produce_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./produce.js */ "../core/node_modules/jose/dist/browser/jwt/produce.js");



class EncryptJWT extends _produce_js__WEBPACK_IMPORTED_MODULE_2__.ProduceJWT {
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setKeyManagementParameters(parameters) {
        if (this._keyManagementParameters) {
            throw new TypeError('setKeyManagementParameters can only be called once');
        }
        this._keyManagementParameters = parameters;
        return this;
    }
    setContentEncryptionKey(cek) {
        if (this._cek) {
            throw new TypeError('setContentEncryptionKey can only be called once');
        }
        this._cek = cek;
        return this;
    }
    setInitializationVector(iv) {
        if (this._iv) {
            throw new TypeError('setInitializationVector can only be called once');
        }
        this._iv = iv;
        return this;
    }
    replicateIssuerAsHeader() {
        this._replicateIssuerAsHeader = true;
        return this;
    }
    replicateSubjectAsHeader() {
        this._replicateSubjectAsHeader = true;
        return this;
    }
    replicateAudienceAsHeader() {
        this._replicateAudienceAsHeader = true;
        return this;
    }
    async encrypt(key, options) {
        const enc = new _jwe_compact_encrypt_js__WEBPACK_IMPORTED_MODULE_0__.CompactEncrypt(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.encoder.encode(JSON.stringify(this._payload)));
        if (this._replicateIssuerAsHeader) {
            this._protectedHeader = { ...this._protectedHeader, iss: this._payload.iss };
        }
        if (this._replicateSubjectAsHeader) {
            this._protectedHeader = { ...this._protectedHeader, sub: this._payload.sub };
        }
        if (this._replicateAudienceAsHeader) {
            this._protectedHeader = { ...this._protectedHeader, aud: this._payload.aud };
        }
        enc.setProtectedHeader(this._protectedHeader);
        if (this._iv) {
            enc.setInitializationVector(this._iv);
        }
        if (this._cek) {
            enc.setContentEncryptionKey(this._cek);
        }
        if (this._keyManagementParameters) {
            enc.setKeyManagementParameters(this._keyManagementParameters);
        }
        return enc.encrypt(key, options);
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/produce.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/produce.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProduceJWT": () => (/* binding */ ProduceJWT)
/* harmony export */ });
/* harmony import */ var _lib_epoch_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/epoch.js */ "../core/node_modules/jose/dist/browser/lib/epoch.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _lib_secs_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/secs.js */ "../core/node_modules/jose/dist/browser/lib/secs.js");



class ProduceJWT {
    constructor(payload) {
        if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_1__["default"])(payload)) {
            throw new TypeError('JWT Claims Set MUST be an object');
        }
        this._payload = payload;
    }
    setIssuer(issuer) {
        this._payload = { ...this._payload, iss: issuer };
        return this;
    }
    setSubject(subject) {
        this._payload = { ...this._payload, sub: subject };
        return this;
    }
    setAudience(audience) {
        this._payload = { ...this._payload, aud: audience };
        return this;
    }
    setJti(jwtId) {
        this._payload = { ...this._payload, jti: jwtId };
        return this;
    }
    setNotBefore(input) {
        if (typeof input === 'number') {
            this._payload = { ...this._payload, nbf: input };
        }
        else {
            this._payload = { ...this._payload, nbf: (0,_lib_epoch_js__WEBPACK_IMPORTED_MODULE_0__["default"])(new Date()) + (0,_lib_secs_js__WEBPACK_IMPORTED_MODULE_2__["default"])(input) };
        }
        return this;
    }
    setExpirationTime(input) {
        if (typeof input === 'number') {
            this._payload = { ...this._payload, exp: input };
        }
        else {
            this._payload = { ...this._payload, exp: (0,_lib_epoch_js__WEBPACK_IMPORTED_MODULE_0__["default"])(new Date()) + (0,_lib_secs_js__WEBPACK_IMPORTED_MODULE_2__["default"])(input) };
        }
        return this;
    }
    setIssuedAt(input) {
        if (typeof input === 'undefined') {
            this._payload = { ...this._payload, iat: (0,_lib_epoch_js__WEBPACK_IMPORTED_MODULE_0__["default"])(new Date()) };
        }
        else {
            this._payload = { ...this._payload, iat: input };
        }
        return this;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/sign.js":
/*!**********************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/sign.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SignJWT": () => (/* binding */ SignJWT)
/* harmony export */ });
/* harmony import */ var _jws_compact_sign_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../jws/compact/sign.js */ "../core/node_modules/jose/dist/browser/jws/compact/sign.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _produce_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./produce.js */ "../core/node_modules/jose/dist/browser/jwt/produce.js");




class SignJWT extends _produce_js__WEBPACK_IMPORTED_MODULE_3__.ProduceJWT {
    setProtectedHeader(protectedHeader) {
        this._protectedHeader = protectedHeader;
        return this;
    }
    async sign(key, options) {
        var _a;
        const sig = new _jws_compact_sign_js__WEBPACK_IMPORTED_MODULE_0__.CompactSign(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_2__.encoder.encode(JSON.stringify(this._payload)));
        sig.setProtectedHeader(this._protectedHeader);
        if (Array.isArray((_a = this._protectedHeader) === null || _a === void 0 ? void 0 : _a.crit) &&
            this._protectedHeader.crit.includes('b64') &&
            this._protectedHeader.b64 === false) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JWTInvalid('JWTs MUST NOT use unencoded payload');
        }
        return sig.sign(key, options);
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/unsecured.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/unsecured.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "UnsecuredJWT": () => (/* binding */ UnsecuredJWT)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/jwt_claims_set.js */ "../core/node_modules/jose/dist/browser/lib/jwt_claims_set.js");
/* harmony import */ var _produce_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./produce.js */ "../core/node_modules/jose/dist/browser/jwt/produce.js");





class UnsecuredJWT extends _produce_js__WEBPACK_IMPORTED_MODULE_4__.ProduceJWT {
    encode() {
        const header = _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode(JSON.stringify({ alg: 'none' }));
        const payload = _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode(JSON.stringify(this._payload));
        return `${header}.${payload}.`;
    }
    static decode(jwt, options) {
        if (typeof jwt !== 'string') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTInvalid('Unsecured JWT must be a string');
        }
        const { 0: encodedHeader, 1: encodedPayload, 2: signature, length } = jwt.split('.');
        if (length !== 3 || signature !== '') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTInvalid('Invalid Unsecured JWT');
        }
        let header;
        try {
            header = JSON.parse(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.decoder.decode(_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode(encodedHeader)));
            if (header.alg !== 'none')
                throw new Error();
        }
        catch (_a) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTInvalid('Invalid Unsecured JWT');
        }
        const payload = (0,_lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_3__["default"])(header, _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode(encodedPayload), options);
        return { payload, header };
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/jwt/verify.js":
/*!************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/jwt/verify.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "jwtVerify": () => (/* binding */ jwtVerify)
/* harmony export */ });
/* harmony import */ var _jws_compact_verify_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../jws/compact/verify.js */ "../core/node_modules/jose/dist/browser/jws/compact/verify.js");
/* harmony import */ var _lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/jwt_claims_set.js */ "../core/node_modules/jose/dist/browser/lib/jwt_claims_set.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");



async function jwtVerify(jwt, key, options) {
    var _a;
    const verified = await (0,_jws_compact_verify_js__WEBPACK_IMPORTED_MODULE_0__.compactVerify)(jwt, key, options);
    if (((_a = verified.protectedHeader.crit) === null || _a === void 0 ? void 0 : _a.includes('b64')) && verified.protectedHeader.b64 === false) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JWTInvalid('JWTs MUST NOT use unencoded payload');
    }
    const payload = (0,_lib_jwt_claims_set_js__WEBPACK_IMPORTED_MODULE_1__["default"])(verified.protectedHeader, verified.payload, options);
    const result = { payload, protectedHeader: verified.protectedHeader };
    if (typeof key === 'function') {
        return { ...result, key: verified.key };
    }
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/key/export.js":
/*!************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/key/export.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "exportJWK": () => (/* binding */ exportJWK),
/* harmony export */   "exportPKCS8": () => (/* binding */ exportPKCS8),
/* harmony export */   "exportSPKI": () => (/* binding */ exportSPKI)
/* harmony export */ });
/* harmony import */ var _runtime_asn1_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/asn1.js */ "../core/node_modules/jose/dist/browser/runtime/asn1.js");
/* harmony import */ var _runtime_key_to_jwk_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/key_to_jwk.js */ "../core/node_modules/jose/dist/browser/runtime/key_to_jwk.js");



async function exportSPKI(key) {
    return (0,_runtime_asn1_js__WEBPACK_IMPORTED_MODULE_0__.toSPKI)(key);
}
async function exportPKCS8(key) {
    return (0,_runtime_asn1_js__WEBPACK_IMPORTED_MODULE_0__.toPKCS8)(key);
}
async function exportJWK(key) {
    return (0,_runtime_key_to_jwk_js__WEBPACK_IMPORTED_MODULE_1__["default"])(key);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/key/generate_key_pair.js":
/*!***********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/key/generate_key_pair.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateKeyPair": () => (/* binding */ generateKeyPair)
/* harmony export */ });
/* harmony import */ var _runtime_generate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/generate.js */ "../core/node_modules/jose/dist/browser/runtime/generate.js");

async function generateKeyPair(alg, options) {
    return (0,_runtime_generate_js__WEBPACK_IMPORTED_MODULE_0__.generateKeyPair)(alg, options);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/key/generate_secret.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/key/generate_secret.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateSecret": () => (/* binding */ generateSecret)
/* harmony export */ });
/* harmony import */ var _runtime_generate_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/generate.js */ "../core/node_modules/jose/dist/browser/runtime/generate.js");

async function generateSecret(alg, options) {
    return (0,_runtime_generate_js__WEBPACK_IMPORTED_MODULE_0__.generateSecret)(alg, options);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/key/import.js":
/*!************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/key/import.js ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "importJWK": () => (/* binding */ importJWK),
/* harmony export */   "importPKCS8": () => (/* binding */ importPKCS8),
/* harmony export */   "importSPKI": () => (/* binding */ importSPKI),
/* harmony export */   "importX509": () => (/* binding */ importX509)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _runtime_asn1_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/asn1.js */ "../core/node_modules/jose/dist/browser/runtime/asn1.js");
/* harmony import */ var _runtime_jwk_to_key_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../runtime/jwk_to_key.js */ "../core/node_modules/jose/dist/browser/runtime/jwk_to_key.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");





async function importSPKI(spki, alg, options) {
    if (typeof spki !== 'string' || spki.indexOf('-----BEGIN PUBLIC KEY-----') !== 0) {
        throw new TypeError('"spki" must be SPKI formatted string');
    }
    return (0,_runtime_asn1_js__WEBPACK_IMPORTED_MODULE_1__.fromSPKI)(spki, alg, options);
}
async function importX509(x509, alg, options) {
    if (typeof x509 !== 'string' || x509.indexOf('-----BEGIN CERTIFICATE-----') !== 0) {
        throw new TypeError('"x509" must be X.509 formatted string');
    }
    return (0,_runtime_asn1_js__WEBPACK_IMPORTED_MODULE_1__.fromX509)(x509, alg, options);
}
async function importPKCS8(pkcs8, alg, options) {
    if (typeof pkcs8 !== 'string' || pkcs8.indexOf('-----BEGIN PRIVATE KEY-----') !== 0) {
        throw new TypeError('"pkcs8" must be PKCS#8 formatted string');
    }
    return (0,_runtime_asn1_js__WEBPACK_IMPORTED_MODULE_1__.fromPKCS8)(pkcs8, alg, options);
}
async function importJWK(jwk, alg, octAsKeyObject) {
    var _a;
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_4__["default"])(jwk)) {
        throw new TypeError('JWK must be an object');
    }
    alg || (alg = jwk.alg);
    switch (jwk.kty) {
        case 'oct':
            if (typeof jwk.k !== 'string' || !jwk.k) {
                throw new TypeError('missing "k" (Key Value) Parameter value');
            }
            octAsKeyObject !== null && octAsKeyObject !== void 0 ? octAsKeyObject : (octAsKeyObject = jwk.ext !== true);
            if (octAsKeyObject) {
                return (0,_runtime_jwk_to_key_js__WEBPACK_IMPORTED_MODULE_2__["default"])({ ...jwk, alg, ext: (_a = jwk.ext) !== null && _a !== void 0 ? _a : false });
            }
            return (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(jwk.k);
        case 'RSA':
            if (jwk.oth !== undefined) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
            }
        case 'EC':
        case 'OKP':
            return (0,_runtime_jwk_to_key_js__WEBPACK_IMPORTED_MODULE_2__["default"])({ ...jwk, alg });
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_3__.JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/aesgcmkw.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/aesgcmkw.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "unwrap": () => (/* binding */ unwrap),
/* harmony export */   "wrap": () => (/* binding */ wrap)
/* harmony export */ });
/* harmony import */ var _runtime_encrypt_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/encrypt.js */ "../core/node_modules/jose/dist/browser/runtime/encrypt.js");
/* harmony import */ var _runtime_decrypt_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/decrypt.js */ "../core/node_modules/jose/dist/browser/runtime/decrypt.js");
/* harmony import */ var _iv_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./iv.js */ "../core/node_modules/jose/dist/browser/lib/iv.js");
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");




async function wrap(alg, key, cek, iv) {
    const jweAlgorithm = alg.slice(0, 7);
    iv || (iv = (0,_iv_js__WEBPACK_IMPORTED_MODULE_2__["default"])(jweAlgorithm));
    const { ciphertext: encryptedKey, tag } = await (0,_runtime_encrypt_js__WEBPACK_IMPORTED_MODULE_0__["default"])(jweAlgorithm, cek, key, iv, new Uint8Array(0));
    return { encryptedKey, iv: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_3__.encode)(iv), tag: (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_3__.encode)(tag) };
}
async function unwrap(alg, key, encryptedKey, iv, tag) {
    const jweAlgorithm = alg.slice(0, 7);
    return (0,_runtime_decrypt_js__WEBPACK_IMPORTED_MODULE_1__["default"])(jweAlgorithm, key, encryptedKey, iv, tag, new Uint8Array(0));
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js":
/*!******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/buffer_utils.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "concat": () => (/* binding */ concat),
/* harmony export */   "concatKdf": () => (/* binding */ concatKdf),
/* harmony export */   "decoder": () => (/* binding */ decoder),
/* harmony export */   "encoder": () => (/* binding */ encoder),
/* harmony export */   "lengthAndInput": () => (/* binding */ lengthAndInput),
/* harmony export */   "p2s": () => (/* binding */ p2s),
/* harmony export */   "uint32be": () => (/* binding */ uint32be),
/* harmony export */   "uint64be": () => (/* binding */ uint64be)
/* harmony export */ });
/* harmony import */ var _runtime_digest_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/digest.js */ "../core/node_modules/jose/dist/browser/runtime/digest.js");

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_INT32 = 2 ** 32;
function concat(...buffers) {
    const size = buffers.reduce((acc, { length }) => acc + length, 0);
    const buf = new Uint8Array(size);
    let i = 0;
    buffers.forEach((buffer) => {
        buf.set(buffer, i);
        i += buffer.length;
    });
    return buf;
}
function p2s(alg, p2sInput) {
    return concat(encoder.encode(alg), new Uint8Array([0]), p2sInput);
}
function writeUInt32BE(buf, value, offset) {
    if (value < 0 || value >= MAX_INT32) {
        throw new RangeError(`value must be >= 0 and <= ${MAX_INT32 - 1}. Received ${value}`);
    }
    buf.set([value >>> 24, value >>> 16, value >>> 8, value & 0xff], offset);
}
function uint64be(value) {
    const high = Math.floor(value / MAX_INT32);
    const low = value % MAX_INT32;
    const buf = new Uint8Array(8);
    writeUInt32BE(buf, high, 0);
    writeUInt32BE(buf, low, 4);
    return buf;
}
function uint32be(value) {
    const buf = new Uint8Array(4);
    writeUInt32BE(buf, value);
    return buf;
}
function lengthAndInput(input) {
    return concat(uint32be(input.length), input);
}
async function concatKdf(secret, bits, value) {
    const iterations = Math.ceil((bits >> 3) / 32);
    const res = new Uint8Array(iterations * 32);
    for (let iter = 0; iter < iterations; iter++) {
        const buf = new Uint8Array(4 + secret.length + value.length);
        buf.set(uint32be(iter + 1));
        buf.set(secret, 4);
        buf.set(value, 4 + secret.length);
        res.set(await (0,_runtime_digest_js__WEBPACK_IMPORTED_MODULE_0__["default"])('sha256', buf), iter * 32);
    }
    return res.slice(0, bits >> 3);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/cek.js":
/*!*********************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/cek.js ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "bitLength": () => (/* binding */ bitLength),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _runtime_random_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/random.js */ "../core/node_modules/jose/dist/browser/runtime/random.js");


function bitLength(alg) {
    switch (alg) {
        case 'A128GCM':
            return 128;
        case 'A192GCM':
            return 192;
        case 'A256GCM':
        case 'A128CBC-HS256':
            return 256;
        case 'A192CBC-HS384':
            return 384;
        case 'A256CBC-HS512':
            return 512;
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported(`Unsupported JWE Algorithm: ${alg}`);
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((alg) => (0,_runtime_random_js__WEBPACK_IMPORTED_MODULE_1__["default"])(new Uint8Array(bitLength(alg) >> 3)));


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/check_iv_length.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/check_iv_length.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _iv_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./iv.js */ "../core/node_modules/jose/dist/browser/lib/iv.js");


const checkIvLength = (enc, iv) => {
    if (iv.length << 3 !== (0,_iv_js__WEBPACK_IMPORTED_MODULE_1__.bitLength)(enc)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWEInvalid('Invalid Initialization Vector length');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (checkIvLength);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/check_key_type.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/check_key_type.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _invalid_key_input_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");


const symmetricTypeCheck = (alg, key) => {
    if (key instanceof Uint8Array)
        return;
    if (!(0,_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__["default"])(key)) {
        throw new TypeError((0,_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_0__.withAlg)(alg, key, ..._runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types, 'Uint8Array'));
    }
    if (key.type !== 'secret') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for symmetric algorithms must be of type "secret"`);
    }
};
const asymmetricTypeCheck = (alg, key, usage) => {
    if (!(0,_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__["default"])(key)) {
        throw new TypeError((0,_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_0__.withAlg)(alg, key, ..._runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types));
    }
    if (key.type === 'secret') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for asymmetric algorithms must not be of type "secret"`);
    }
    if (usage === 'sign' && key.type === 'public') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for asymmetric algorithm signing must be of type "private"`);
    }
    if (usage === 'decrypt' && key.type === 'public') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for asymmetric algorithm decryption must be of type "private"`);
    }
    if (key.algorithm && usage === 'verify' && key.type === 'private') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for asymmetric algorithm verifying must be of type "public"`);
    }
    if (key.algorithm && usage === 'encrypt' && key.type === 'private') {
        throw new TypeError(`${_runtime_is_key_like_js__WEBPACK_IMPORTED_MODULE_1__.types.join(' or ')} instances for asymmetric algorithm encryption must be of type "public"`);
    }
};
const checkKeyType = (alg, key, usage) => {
    const symmetric = alg.startsWith('HS') ||
        alg === 'dir' ||
        alg.startsWith('PBES2') ||
        /^A\d{3}(?:GCM)?KW$/.test(alg);
    if (symmetric) {
        symmetricTypeCheck(alg, key);
    }
    else {
        asymmetricTypeCheck(alg, key, usage);
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (checkKeyType);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/check_p2s.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/check_p2s.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ checkP2s)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

function checkP2s(p2s) {
    if (!(p2s instanceof Uint8Array) || p2s.length < 8) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWEInvalid('PBES2 Salt Input must be 8 or more octets');
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/crypto_key.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/crypto_key.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "checkEncCryptoKey": () => (/* binding */ checkEncCryptoKey),
/* harmony export */   "checkSigCryptoKey": () => (/* binding */ checkSigCryptoKey)
/* harmony export */ });
/* harmony import */ var _runtime_env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");

function unusable(name, prop = 'algorithm.name') {
    return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
function isAlgorithm(algorithm, name) {
    return algorithm.name === name;
}
function getHashLength(hash) {
    return parseInt(hash.name.slice(4), 10);
}
function getNamedCurve(alg) {
    switch (alg) {
        case 'ES256':
            return 'P-256';
        case 'ES384':
            return 'P-384';
        case 'ES512':
            return 'P-521';
        default:
            throw new Error('unreachable');
    }
}
function checkUsage(key, usages) {
    if (usages.length && !usages.some((expected) => key.usages.includes(expected))) {
        let msg = 'CryptoKey does not support this operation, its usages must include ';
        if (usages.length > 2) {
            const last = usages.pop();
            msg += `one of ${usages.join(', ')}, or ${last}.`;
        }
        else if (usages.length === 2) {
            msg += `one of ${usages[0]} or ${usages[1]}.`;
        }
        else {
            msg += `${usages[0]}.`;
        }
        throw new TypeError(msg);
    }
}
function checkSigCryptoKey(key, alg, ...usages) {
    switch (alg) {
        case 'HS256':
        case 'HS384':
        case 'HS512': {
            if (!isAlgorithm(key.algorithm, 'HMAC'))
                throw unusable('HMAC');
            const expected = parseInt(alg.slice(2), 10);
            const actual = getHashLength(key.algorithm.hash);
            if (actual !== expected)
                throw unusable(`SHA-${expected}`, 'algorithm.hash');
            break;
        }
        case 'RS256':
        case 'RS384':
        case 'RS512': {
            if (!isAlgorithm(key.algorithm, 'RSASSA-PKCS1-v1_5'))
                throw unusable('RSASSA-PKCS1-v1_5');
            const expected = parseInt(alg.slice(2), 10);
            const actual = getHashLength(key.algorithm.hash);
            if (actual !== expected)
                throw unusable(`SHA-${expected}`, 'algorithm.hash');
            break;
        }
        case 'PS256':
        case 'PS384':
        case 'PS512': {
            if (!isAlgorithm(key.algorithm, 'RSA-PSS'))
                throw unusable('RSA-PSS');
            const expected = parseInt(alg.slice(2), 10);
            const actual = getHashLength(key.algorithm.hash);
            if (actual !== expected)
                throw unusable(`SHA-${expected}`, 'algorithm.hash');
            break;
        }
        case 'EdDSA': {
            if (key.algorithm.name !== 'Ed25519' && key.algorithm.name !== 'Ed448') {
                if ((0,_runtime_env_js__WEBPACK_IMPORTED_MODULE_0__.isCloudflareWorkers)()) {
                    if (isAlgorithm(key.algorithm, 'NODE-ED25519'))
                        break;
                    throw unusable('Ed25519, Ed448, or NODE-ED25519');
                }
                throw unusable('Ed25519 or Ed448');
            }
            break;
        }
        case 'ES256':
        case 'ES384':
        case 'ES512': {
            if (!isAlgorithm(key.algorithm, 'ECDSA'))
                throw unusable('ECDSA');
            const expected = getNamedCurve(alg);
            const actual = key.algorithm.namedCurve;
            if (actual !== expected)
                throw unusable(expected, 'algorithm.namedCurve');
            break;
        }
        default:
            throw new TypeError('CryptoKey does not support this operation');
    }
    checkUsage(key, usages);
}
function checkEncCryptoKey(key, alg, ...usages) {
    switch (alg) {
        case 'A128GCM':
        case 'A192GCM':
        case 'A256GCM': {
            if (!isAlgorithm(key.algorithm, 'AES-GCM'))
                throw unusable('AES-GCM');
            const expected = parseInt(alg.slice(1, 4), 10);
            const actual = key.algorithm.length;
            if (actual !== expected)
                throw unusable(expected, 'algorithm.length');
            break;
        }
        case 'A128KW':
        case 'A192KW':
        case 'A256KW': {
            if (!isAlgorithm(key.algorithm, 'AES-KW'))
                throw unusable('AES-KW');
            const expected = parseInt(alg.slice(1, 4), 10);
            const actual = key.algorithm.length;
            if (actual !== expected)
                throw unusable(expected, 'algorithm.length');
            break;
        }
        case 'ECDH': {
            switch (key.algorithm.name) {
                case 'ECDH':
                case 'X25519':
                case 'X448':
                    break;
                default:
                    throw unusable('ECDH, X25519, or X448');
            }
            break;
        }
        case 'PBES2-HS256+A128KW':
        case 'PBES2-HS384+A192KW':
        case 'PBES2-HS512+A256KW':
            if (!isAlgorithm(key.algorithm, 'PBKDF2'))
                throw unusable('PBKDF2');
            break;
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512': {
            if (!isAlgorithm(key.algorithm, 'RSA-OAEP'))
                throw unusable('RSA-OAEP');
            const expected = parseInt(alg.slice(9), 10) || 1;
            const actual = getHashLength(key.algorithm.hash);
            if (actual !== expected)
                throw unusable(`SHA-${expected}`, 'algorithm.hash');
            break;
        }
        default:
            throw new TypeError('CryptoKey does not support this operation');
    }
    checkUsage(key, usages);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/decrypt_key_management.js":
/*!****************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/decrypt_key_management.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/aeskw.js */ "../core/node_modules/jose/dist/browser/runtime/aeskw.js");
/* harmony import */ var _runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/ecdhes.js */ "../core/node_modules/jose/dist/browser/runtime/ecdhes.js");
/* harmony import */ var _runtime_pbes2kw_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../runtime/pbes2kw.js */ "../core/node_modules/jose/dist/browser/runtime/pbes2kw.js");
/* harmony import */ var _runtime_rsaes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../runtime/rsaes.js */ "../core/node_modules/jose/dist/browser/runtime/rsaes.js");
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _lib_cek_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/cek.js */ "../core/node_modules/jose/dist/browser/lib/cek.js");
/* harmony import */ var _key_import_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../key/import.js */ "../core/node_modules/jose/dist/browser/key/import.js");
/* harmony import */ var _check_key_type_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./check_key_type.js */ "../core/node_modules/jose/dist/browser/lib/check_key_type.js");
/* harmony import */ var _is_object_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _aesgcmkw_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./aesgcmkw.js */ "../core/node_modules/jose/dist/browser/lib/aesgcmkw.js");











async function decryptKeyManagement(alg, key, encryptedKey, joseHeader, options) {
    (0,_check_key_type_js__WEBPACK_IMPORTED_MODULE_8__["default"])(alg, key, 'decrypt');
    switch (alg) {
        case 'dir': {
            if (encryptedKey !== undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('Encountered unexpected JWE Encrypted Key');
            return key;
        }
        case 'ECDH-ES':
            if (encryptedKey !== undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('Encountered unexpected JWE Encrypted Key');
        case 'ECDH-ES+A128KW':
        case 'ECDH-ES+A192KW':
        case 'ECDH-ES+A256KW': {
            if (!(0,_is_object_js__WEBPACK_IMPORTED_MODULE_9__["default"])(joseHeader.epk))
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "epk" (Ephemeral Public Key) missing or invalid`);
            if (!_runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__.ecdhAllowed(key))
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JOSENotSupported('ECDH with the provided key is not allowed or not supported by your javascript runtime');
            const epk = await (0,_key_import_js__WEBPACK_IMPORTED_MODULE_7__.importJWK)(joseHeader.epk, alg);
            let partyUInfo;
            let partyVInfo;
            if (joseHeader.apu !== undefined) {
                if (typeof joseHeader.apu !== 'string')
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "apu" (Agreement PartyUInfo) invalid`);
                partyUInfo = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.decode)(joseHeader.apu);
            }
            if (joseHeader.apv !== undefined) {
                if (typeof joseHeader.apv !== 'string')
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "apv" (Agreement PartyVInfo) invalid`);
                partyVInfo = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.decode)(joseHeader.apv);
            }
            const sharedSecret = await _runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__.deriveKey(epk, key, alg === 'ECDH-ES' ? joseHeader.enc : alg, alg === 'ECDH-ES' ? (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_6__.bitLength)(joseHeader.enc) : parseInt(alg.slice(-5, -2), 10), partyUInfo, partyVInfo);
            if (alg === 'ECDH-ES')
                return sharedSecret;
            if (encryptedKey === undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Encrypted Key missing');
            return (0,_runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__.unwrap)(alg.slice(-6), sharedSecret, encryptedKey);
        }
        case 'RSA1_5':
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512': {
            if (encryptedKey === undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Encrypted Key missing');
            return (0,_runtime_rsaes_js__WEBPACK_IMPORTED_MODULE_3__.decrypt)(alg, key, encryptedKey);
        }
        case 'PBES2-HS256+A128KW':
        case 'PBES2-HS384+A192KW':
        case 'PBES2-HS512+A256KW': {
            if (encryptedKey === undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Encrypted Key missing');
            if (typeof joseHeader.p2c !== 'number')
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "p2c" (PBES2 Count) missing or invalid`);
            const p2cLimit = (options === null || options === void 0 ? void 0 : options.maxPBES2Count) || 10000;
            if (joseHeader.p2c > p2cLimit)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "p2c" (PBES2 Count) out is of acceptable bounds`);
            if (typeof joseHeader.p2s !== 'string')
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "p2s" (PBES2 Salt) missing or invalid`);
            return (0,_runtime_pbes2kw_js__WEBPACK_IMPORTED_MODULE_2__.decrypt)(alg, key, encryptedKey, joseHeader.p2c, (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.decode)(joseHeader.p2s));
        }
        case 'A128KW':
        case 'A192KW':
        case 'A256KW': {
            if (encryptedKey === undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Encrypted Key missing');
            return (0,_runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__.unwrap)(alg, key, encryptedKey);
        }
        case 'A128GCMKW':
        case 'A192GCMKW':
        case 'A256GCMKW': {
            if (encryptedKey === undefined)
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid('JWE Encrypted Key missing');
            if (typeof joseHeader.iv !== 'string')
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "iv" (Initialization Vector) missing or invalid`);
            if (typeof joseHeader.tag !== 'string')
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JWEInvalid(`JOSE Header "tag" (Authentication Tag) missing or invalid`);
            const iv = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.decode)(joseHeader.iv);
            const tag = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.decode)(joseHeader.tag);
            return (0,_aesgcmkw_js__WEBPACK_IMPORTED_MODULE_10__.unwrap)(alg, key, encryptedKey, iv, tag);
        }
        default: {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JOSENotSupported('Invalid or unsupported "alg" (JWE Algorithm) header value');
        }
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (decryptKeyManagement);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/encrypt_key_management.js":
/*!****************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/encrypt_key_management.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/aeskw.js */ "../core/node_modules/jose/dist/browser/runtime/aeskw.js");
/* harmony import */ var _runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/ecdhes.js */ "../core/node_modules/jose/dist/browser/runtime/ecdhes.js");
/* harmony import */ var _runtime_pbes2kw_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../runtime/pbes2kw.js */ "../core/node_modules/jose/dist/browser/runtime/pbes2kw.js");
/* harmony import */ var _runtime_rsaes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../runtime/rsaes.js */ "../core/node_modules/jose/dist/browser/runtime/rsaes.js");
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _lib_cek_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/cek.js */ "../core/node_modules/jose/dist/browser/lib/cek.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _key_export_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../key/export.js */ "../core/node_modules/jose/dist/browser/key/export.js");
/* harmony import */ var _check_key_type_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./check_key_type.js */ "../core/node_modules/jose/dist/browser/lib/check_key_type.js");
/* harmony import */ var _aesgcmkw_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./aesgcmkw.js */ "../core/node_modules/jose/dist/browser/lib/aesgcmkw.js");










async function encryptKeyManagement(alg, enc, key, providedCek, providedParameters = {}) {
    let encryptedKey;
    let parameters;
    let cek;
    (0,_check_key_type_js__WEBPACK_IMPORTED_MODULE_8__["default"])(alg, key, 'encrypt');
    switch (alg) {
        case 'dir': {
            cek = key;
            break;
        }
        case 'ECDH-ES':
        case 'ECDH-ES+A128KW':
        case 'ECDH-ES+A192KW':
        case 'ECDH-ES+A256KW': {
            if (!_runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__.ecdhAllowed(key)) {
                throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_6__.JOSENotSupported('ECDH with the provided key is not allowed or not supported by your javascript runtime');
            }
            const { apu, apv } = providedParameters;
            let { epk: ephemeralKey } = providedParameters;
            ephemeralKey || (ephemeralKey = (await _runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__.generateEpk(key)).privateKey);
            const { x, y, crv, kty } = await (0,_key_export_js__WEBPACK_IMPORTED_MODULE_7__.exportJWK)(ephemeralKey);
            const sharedSecret = await _runtime_ecdhes_js__WEBPACK_IMPORTED_MODULE_1__.deriveKey(key, ephemeralKey, alg === 'ECDH-ES' ? enc : alg, alg === 'ECDH-ES' ? (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__.bitLength)(enc) : parseInt(alg.slice(-5, -2), 10), apu, apv);
            parameters = { epk: { x, crv, kty } };
            if (kty === 'EC')
                parameters.epk.y = y;
            if (apu)
                parameters.apu = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.encode)(apu);
            if (apv)
                parameters.apv = (0,_runtime_base64url_js__WEBPACK_IMPORTED_MODULE_4__.encode)(apv);
            if (alg === 'ECDH-ES') {
                cek = sharedSecret;
                break;
            }
            cek = providedCek || (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__["default"])(enc);
            const kwAlg = alg.slice(-6);
            encryptedKey = await (0,_runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__.wrap)(kwAlg, sharedSecret, cek);
            break;
        }
        case 'RSA1_5':
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512': {
            cek = providedCek || (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__["default"])(enc);
            encryptedKey = await (0,_runtime_rsaes_js__WEBPACK_IMPORTED_MODULE_3__.encrypt)(alg, key, cek);
            break;
        }
        case 'PBES2-HS256+A128KW':
        case 'PBES2-HS384+A192KW':
        case 'PBES2-HS512+A256KW': {
            cek = providedCek || (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__["default"])(enc);
            const { p2c, p2s } = providedParameters;
            ({ encryptedKey, ...parameters } = await (0,_runtime_pbes2kw_js__WEBPACK_IMPORTED_MODULE_2__.encrypt)(alg, key, cek, p2c, p2s));
            break;
        }
        case 'A128KW':
        case 'A192KW':
        case 'A256KW': {
            cek = providedCek || (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__["default"])(enc);
            encryptedKey = await (0,_runtime_aeskw_js__WEBPACK_IMPORTED_MODULE_0__.wrap)(alg, key, cek);
            break;
        }
        case 'A128GCMKW':
        case 'A192GCMKW':
        case 'A256GCMKW': {
            cek = providedCek || (0,_lib_cek_js__WEBPACK_IMPORTED_MODULE_5__["default"])(enc);
            const { iv } = providedParameters;
            ({ encryptedKey, ...parameters } = await (0,_aesgcmkw_js__WEBPACK_IMPORTED_MODULE_9__.wrap)(alg, key, cek, iv));
            break;
        }
        default: {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_6__.JOSENotSupported('Invalid or unsupported "alg" (JWE Algorithm) header value');
        }
    }
    return { cek, encryptedKey, parameters };
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (encryptKeyManagement);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/epoch.js":
/*!***********************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/epoch.js ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((date) => Math.floor(date.getTime() / 1000));


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/format_pem.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/format_pem.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((b64, descriptor) => {
    const newlined = (b64.match(/.{1,64}/g) || []).join('\n');
    return `-----BEGIN ${descriptor}-----\n${newlined}\n-----END ${descriptor}-----`;
});


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js":
/*!***********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/invalid_key_input.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "withAlg": () => (/* binding */ withAlg)
/* harmony export */ });
function message(msg, actual, ...types) {
    if (types.length > 2) {
        const last = types.pop();
        msg += `one of type ${types.join(', ')}, or ${last}.`;
    }
    else if (types.length === 2) {
        msg += `one of type ${types[0]} or ${types[1]}.`;
    }
    else {
        msg += `of type ${types[0]}.`;
    }
    if (actual == null) {
        msg += ` Received ${actual}`;
    }
    else if (typeof actual === 'function' && actual.name) {
        msg += ` Received function ${actual.name}`;
    }
    else if (typeof actual === 'object' && actual != null) {
        if (actual.constructor && actual.constructor.name) {
            msg += ` Received an instance of ${actual.constructor.name}`;
        }
    }
    return msg;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((actual, ...types) => {
    return message('Key must be ', actual, ...types);
});
function withAlg(alg, actual, ...types) {
    return message(`Key for the ${alg} algorithm must be `, actual, ...types);
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/is_disjoint.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/is_disjoint.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const isDisjoint = (...headers) => {
    const sources = headers.filter(Boolean);
    if (sources.length === 0 || sources.length === 1) {
        return true;
    }
    let acc;
    for (const header of sources) {
        const parameters = Object.keys(header);
        if (!acc || acc.size === 0) {
            acc = new Set(parameters);
            continue;
        }
        for (const parameter of parameters) {
            if (acc.has(parameter)) {
                return false;
            }
            acc.add(parameter);
        }
    }
    return true;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (isDisjoint);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/is_object.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/is_object.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ isObject)
/* harmony export */ });
function isObjectLike(value) {
    return typeof value === 'object' && value !== null;
}
function isObject(input) {
    if (!isObjectLike(input) || Object.prototype.toString.call(input) !== '[object Object]') {
        return false;
    }
    if (Object.getPrototypeOf(input) === null) {
        return true;
    }
    let proto = input;
    while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(input) === proto;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/iv.js":
/*!********************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/iv.js ***!
  \********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "bitLength": () => (/* binding */ bitLength),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _runtime_random_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../runtime/random.js */ "../core/node_modules/jose/dist/browser/runtime/random.js");


function bitLength(alg) {
    switch (alg) {
        case 'A128GCM':
        case 'A128GCMKW':
        case 'A192GCM':
        case 'A192GCMKW':
        case 'A256GCM':
        case 'A256GCMKW':
            return 96;
        case 'A128CBC-HS256':
        case 'A192CBC-HS384':
        case 'A256CBC-HS512':
            return 128;
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported(`Unsupported JWE Algorithm: ${alg}`);
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((alg) => (0,_runtime_random_js__WEBPACK_IMPORTED_MODULE_1__["default"])(new Uint8Array(bitLength(alg) >> 3)));


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/jwt_claims_set.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/jwt_claims_set.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _epoch_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./epoch.js */ "../core/node_modules/jose/dist/browser/lib/epoch.js");
/* harmony import */ var _secs_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./secs.js */ "../core/node_modules/jose/dist/browser/lib/secs.js");
/* harmony import */ var _is_object_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");





const normalizeTyp = (value) => value.toLowerCase().replace(/^application\//, '');
const checkAudiencePresence = (audPayload, audOption) => {
    if (typeof audPayload === 'string') {
        return audOption.includes(audPayload);
    }
    if (Array.isArray(audPayload)) {
        return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
    }
    return false;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((protectedHeader, encodedPayload, options = {}) => {
    const { typ } = options;
    if (typ &&
        (typeof protectedHeader.typ !== 'string' ||
            normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('unexpected "typ" JWT header value', 'typ', 'check_failed');
    }
    let payload;
    try {
        payload = JSON.parse(_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.decoder.decode(encodedPayload));
    }
    catch (_a) {
    }
    if (!(0,_is_object_js__WEBPACK_IMPORTED_MODULE_4__["default"])(payload)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTInvalid('JWT Claims Set must be a top-level JSON object');
    }
    const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
    if (maxTokenAge !== undefined)
        requiredClaims.push('iat');
    if (audience !== undefined)
        requiredClaims.push('aud');
    if (subject !== undefined)
        requiredClaims.push('sub');
    if (issuer !== undefined)
        requiredClaims.push('iss');
    for (const claim of new Set(requiredClaims.reverse())) {
        if (!(claim in payload)) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed(`missing required "${claim}" claim`, claim, 'missing');
        }
    }
    if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('unexpected "iss" claim value', 'iss', 'check_failed');
    }
    if (subject && payload.sub !== subject) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('unexpected "sub" claim value', 'sub', 'check_failed');
    }
    if (audience &&
        !checkAudiencePresence(payload.aud, typeof audience === 'string' ? [audience] : audience)) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('unexpected "aud" claim value', 'aud', 'check_failed');
    }
    let tolerance;
    switch (typeof options.clockTolerance) {
        case 'string':
            tolerance = (0,_secs_js__WEBPACK_IMPORTED_MODULE_3__["default"])(options.clockTolerance);
            break;
        case 'number':
            tolerance = options.clockTolerance;
            break;
        case 'undefined':
            tolerance = 0;
            break;
        default:
            throw new TypeError('Invalid clockTolerance option type');
    }
    const { currentDate } = options;
    const now = (0,_epoch_js__WEBPACK_IMPORTED_MODULE_2__["default"])(currentDate || new Date());
    if ((payload.iat !== undefined || maxTokenAge) && typeof payload.iat !== 'number') {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('"iat" claim must be a number', 'iat', 'invalid');
    }
    if (payload.nbf !== undefined) {
        if (typeof payload.nbf !== 'number') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('"nbf" claim must be a number', 'nbf', 'invalid');
        }
        if (payload.nbf > now + tolerance) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('"nbf" claim timestamp check failed', 'nbf', 'check_failed');
        }
    }
    if (payload.exp !== undefined) {
        if (typeof payload.exp !== 'number') {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('"exp" claim must be a number', 'exp', 'invalid');
        }
        if (payload.exp <= now - tolerance) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTExpired('"exp" claim timestamp check failed', 'exp', 'check_failed');
        }
    }
    if (maxTokenAge) {
        const age = now - payload.iat;
        const max = typeof maxTokenAge === 'number' ? maxTokenAge : (0,_secs_js__WEBPACK_IMPORTED_MODULE_3__["default"])(maxTokenAge);
        if (age - tolerance > max) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTExpired('"iat" claim timestamp check failed (too far in the past)', 'iat', 'check_failed');
        }
        if (age < 0 - tolerance) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', 'iat', 'check_failed');
        }
    }
    return payload;
});


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/secs.js":
/*!**********************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/secs.js ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const year = day * 365.25;
const REGEX = /^(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((str) => {
    const matched = REGEX.exec(str);
    if (!matched) {
        throw new TypeError('Invalid time period format');
    }
    const value = parseFloat(matched[1]);
    const unit = matched[2].toLowerCase();
    switch (unit) {
        case 'sec':
        case 'secs':
        case 'second':
        case 'seconds':
        case 's':
            return Math.round(value);
        case 'minute':
        case 'minutes':
        case 'min':
        case 'mins':
        case 'm':
            return Math.round(value * minute);
        case 'hour':
        case 'hours':
        case 'hr':
        case 'hrs':
        case 'h':
            return Math.round(value * hour);
        case 'day':
        case 'days':
        case 'd':
            return Math.round(value * day);
        case 'week':
        case 'weeks':
        case 'w':
            return Math.round(value * week);
        default:
            return Math.round(value * year);
    }
});


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/validate_algorithms.js":
/*!*************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/validate_algorithms.js ***!
  \*************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const validateAlgorithms = (option, algorithms) => {
    if (algorithms !== undefined &&
        (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== 'string'))) {
        throw new TypeError(`"${option}" option must be an array of strings`);
    }
    if (!algorithms) {
        return undefined;
    }
    return new Set(algorithms);
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (validateAlgorithms);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/lib/validate_crit.js":
/*!*******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/lib/validate_crit.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
    if (joseHeader.crit !== undefined && protectedHeader.crit === undefined) {
        throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
    }
    if (!protectedHeader || protectedHeader.crit === undefined) {
        return new Set();
    }
    if (!Array.isArray(protectedHeader.crit) ||
        protectedHeader.crit.length === 0 ||
        protectedHeader.crit.some((input) => typeof input !== 'string' || input.length === 0)) {
        throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
    }
    let recognized;
    if (recognizedOption !== undefined) {
        recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
    }
    else {
        recognized = recognizedDefault;
    }
    for (const parameter of protectedHeader.crit) {
        if (!recognized.has(parameter)) {
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
        }
        if (joseHeader[parameter] === undefined) {
            throw new Err(`Extension Header Parameter "${parameter}" is missing`);
        }
        else if (recognized.get(parameter) && protectedHeader[parameter] === undefined) {
            throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
        }
    }
    return new Set(protectedHeader.crit);
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (validateCrit);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/aeskw.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/aeskw.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "unwrap": () => (/* binding */ unwrap),
/* harmony export */   "wrap": () => (/* binding */ wrap)
/* harmony export */ });
/* harmony import */ var _bogus_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bogus.js */ "../core/node_modules/jose/dist/browser/runtime/bogus.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");





function checkKeySize(key, alg) {
    if (key.algorithm.length !== parseInt(alg.slice(1, 4), 10)) {
        throw new TypeError(`Invalid key size for alg: ${alg}`);
    }
}
function getCryptoKey(key, alg, usage) {
    if ((0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(key)) {
        (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_2__.checkEncCryptoKey)(key, alg, usage);
        return key;
    }
    if (key instanceof Uint8Array) {
        return _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey('raw', key, 'AES-KW', true, [usage]);
    }
    throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_4__.types, 'Uint8Array'));
}
const wrap = async (alg, key, cek) => {
    const cryptoKey = await getCryptoKey(key, alg, 'wrapKey');
    checkKeySize(cryptoKey, alg);
    const cryptoKeyCek = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey('raw', cek, ..._bogus_js__WEBPACK_IMPORTED_MODULE_0__["default"]);
    return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.wrapKey('raw', cryptoKeyCek, cryptoKey, 'AES-KW'));
};
const unwrap = async (alg, key, encryptedKey) => {
    const cryptoKey = await getCryptoKey(key, alg, 'unwrapKey');
    checkKeySize(cryptoKey, alg);
    const cryptoKeyCek = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.unwrapKey('raw', encryptedKey, cryptoKey, 'AES-KW', ..._bogus_js__WEBPACK_IMPORTED_MODULE_0__["default"]);
    return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.exportKey('raw', cryptoKeyCek));
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/asn1.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/asn1.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fromPKCS8": () => (/* binding */ fromPKCS8),
/* harmony export */   "fromSPKI": () => (/* binding */ fromSPKI),
/* harmony export */   "fromX509": () => (/* binding */ fromX509),
/* harmony export */   "toPKCS8": () => (/* binding */ toPKCS8),
/* harmony export */   "toSPKI": () => (/* binding */ toSPKI)
/* harmony export */ });
/* harmony import */ var _env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _lib_format_pem_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/format_pem.js */ "../core/node_modules/jose/dist/browser/lib/format_pem.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");







const genericExport = async (keyType, keyFormat, key) => {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_2__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_6__.types));
    }
    if (!key.extractable) {
        throw new TypeError('CryptoKey is not extractable');
    }
    if (key.type !== keyType) {
        throw new TypeError(`key is not a ${keyType} key`);
    }
    return (0,_lib_format_pem_js__WEBPACK_IMPORTED_MODULE_4__["default"])((0,_base64url_js__WEBPACK_IMPORTED_MODULE_3__.encodeBase64)(new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.exportKey(keyFormat, key))), `${keyType.toUpperCase()} KEY`);
};
const toSPKI = (key) => {
    return genericExport('public', 'spki', key);
};
const toPKCS8 = (key) => {
    return genericExport('private', 'pkcs8', key);
};
const findOid = (keyData, oid, from = 0) => {
    if (from === 0) {
        oid.unshift(oid.length);
        oid.unshift(0x06);
    }
    let i = keyData.indexOf(oid[0], from);
    if (i === -1)
        return false;
    const sub = keyData.subarray(i, i + oid.length);
    if (sub.length !== oid.length)
        return false;
    return sub.every((value, index) => value === oid[index]) || findOid(keyData, oid, i + 1);
};
const getNamedCurve = (keyData) => {
    switch (true) {
        case findOid(keyData, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]):
            return 'P-256';
        case findOid(keyData, [0x2b, 0x81, 0x04, 0x00, 0x22]):
            return 'P-384';
        case findOid(keyData, [0x2b, 0x81, 0x04, 0x00, 0x23]):
            return 'P-521';
        case findOid(keyData, [0x2b, 0x65, 0x6e]):
            return 'X25519';
        case findOid(keyData, [0x2b, 0x65, 0x6f]):
            return 'X448';
        case findOid(keyData, [0x2b, 0x65, 0x70]):
            return 'Ed25519';
        case findOid(keyData, [0x2b, 0x65, 0x71]):
            return 'Ed448';
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JOSENotSupported('Invalid or unsupported EC Key Curve or OKP Key Sub Type');
    }
};
const genericImport = async (replace, keyFormat, pem, alg, options) => {
    var _a, _b;
    let algorithm;
    let keyUsages;
    const keyData = new Uint8Array(atob(pem.replace(replace, ''))
        .split('')
        .map((c) => c.charCodeAt(0)));
    const isPublic = keyFormat === 'spki';
    switch (alg) {
        case 'PS256':
        case 'PS384':
        case 'PS512':
            algorithm = { name: 'RSA-PSS', hash: `SHA-${alg.slice(-3)}` };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        case 'RS256':
        case 'RS384':
        case 'RS512':
            algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: `SHA-${alg.slice(-3)}` };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512':
            algorithm = {
                name: 'RSA-OAEP',
                hash: `SHA-${parseInt(alg.slice(-3), 10) || 1}`,
            };
            keyUsages = isPublic ? ['encrypt', 'wrapKey'] : ['decrypt', 'unwrapKey'];
            break;
        case 'ES256':
            algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        case 'ES384':
            algorithm = { name: 'ECDSA', namedCurve: 'P-384' };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        case 'ES512':
            algorithm = { name: 'ECDSA', namedCurve: 'P-521' };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        case 'ECDH-ES':
        case 'ECDH-ES+A128KW':
        case 'ECDH-ES+A192KW':
        case 'ECDH-ES+A256KW': {
            const namedCurve = getNamedCurve(keyData);
            algorithm = namedCurve.startsWith('P-') ? { name: 'ECDH', namedCurve } : { name: namedCurve };
            keyUsages = isPublic ? [] : ['deriveBits'];
            break;
        }
        case 'EdDSA':
            algorithm = { name: getNamedCurve(keyData) };
            keyUsages = isPublic ? ['verify'] : ['sign'];
            break;
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_5__.JOSENotSupported('Invalid or unsupported "alg" (Algorithm) value');
    }
    try {
        return await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey(keyFormat, keyData, algorithm, (_a = options === null || options === void 0 ? void 0 : options.extractable) !== null && _a !== void 0 ? _a : false, keyUsages);
    }
    catch (err) {
        if (algorithm.name === 'Ed25519' &&
            (err === null || err === void 0 ? void 0 : err.name) === 'NotSupportedError' &&
            (0,_env_js__WEBPACK_IMPORTED_MODULE_0__.isCloudflareWorkers)()) {
            algorithm = { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' };
            return await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey(keyFormat, keyData, algorithm, (_b = options === null || options === void 0 ? void 0 : options.extractable) !== null && _b !== void 0 ? _b : false, keyUsages);
        }
        throw err;
    }
};
const fromPKCS8 = (pem, alg, options) => {
    return genericImport(/(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g, 'pkcs8', pem, alg, options);
};
const fromSPKI = (pem, alg, options) => {
    return genericImport(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, 'spki', pem, alg, options);
};
function getElement(seq) {
    let result = [];
    let next = 0;
    while (next < seq.length) {
        let nextPart = parseElement(seq.subarray(next));
        result.push(nextPart);
        next += nextPart.byteLength;
    }
    return result;
}
function parseElement(bytes) {
    let position = 0;
    let tag = bytes[0] & 0x1f;
    position++;
    if (tag === 0x1f) {
        tag = 0;
        while (bytes[position] >= 0x80) {
            tag = tag * 128 + bytes[position] - 0x80;
            position++;
        }
        tag = tag * 128 + bytes[position] - 0x80;
        position++;
    }
    let length = 0;
    if (bytes[position] < 0x80) {
        length = bytes[position];
        position++;
    }
    else if (length === 0x80) {
        length = 0;
        while (bytes[position + length] !== 0 || bytes[position + length + 1] !== 0) {
            if (length > bytes.byteLength) {
                throw new TypeError('invalid indefinite form length');
            }
            length++;
        }
        const byteLength = position + length + 2;
        return {
            byteLength,
            contents: bytes.subarray(position, position + length),
            raw: bytes.subarray(0, byteLength),
        };
    }
    else {
        let numberOfDigits = bytes[position] & 0x7f;
        position++;
        length = 0;
        for (let i = 0; i < numberOfDigits; i++) {
            length = length * 256 + bytes[position];
            position++;
        }
    }
    const byteLength = position + length;
    return {
        byteLength,
        contents: bytes.subarray(position, byteLength),
        raw: bytes.subarray(0, byteLength),
    };
}
function spkiFromX509(buf) {
    const tbsCertificate = getElement(getElement(parseElement(buf).contents)[0].contents);
    return (0,_base64url_js__WEBPACK_IMPORTED_MODULE_3__.encodeBase64)(tbsCertificate[tbsCertificate[0].raw[0] === 0xa0 ? 6 : 5].raw);
}
function getSPKI(x509) {
    const pem = x509.replace(/(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g, '');
    const raw = (0,_base64url_js__WEBPACK_IMPORTED_MODULE_3__.decodeBase64)(pem);
    return (0,_lib_format_pem_js__WEBPACK_IMPORTED_MODULE_4__["default"])(spkiFromX509(raw), 'PUBLIC KEY');
}
const fromX509 = (pem, alg, options) => {
    let spki;
    try {
        spki = getSPKI(pem);
    }
    catch (cause) {
        throw new TypeError('failed to parse the X.509 certificate', { cause });
    }
    return fromSPKI(spki, alg, options);
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/base64url.js":
/*!*******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/base64url.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decode": () => (/* binding */ decode),
/* harmony export */   "decodeBase64": () => (/* binding */ decodeBase64),
/* harmony export */   "encode": () => (/* binding */ encode),
/* harmony export */   "encodeBase64": () => (/* binding */ encodeBase64)
/* harmony export */ });
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");

const encodeBase64 = (input) => {
    let unencoded = input;
    if (typeof unencoded === 'string') {
        unencoded = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.encoder.encode(unencoded);
    }
    const CHUNK_SIZE = 0x8000;
    const arr = [];
    for (let i = 0; i < unencoded.length; i += CHUNK_SIZE) {
        arr.push(String.fromCharCode.apply(null, unencoded.subarray(i, i + CHUNK_SIZE)));
    }
    return btoa(arr.join(''));
};
const encode = (input) => {
    return encodeBase64(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const decodeBase64 = (encoded) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};
const decode = (input) => {
    let encoded = input;
    if (encoded instanceof Uint8Array) {
        encoded = _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.decoder.decode(encoded);
    }
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    try {
        return decodeBase64(encoded);
    }
    catch (_a) {
        throw new TypeError('The input to be decoded is not correctly encoded.');
    }
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/bogus.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/bogus.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const bogusWebCrypto = [
    { hash: 'SHA-256', name: 'HMAC' },
    true,
    ['sign'],
];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (bogusWebCrypto);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/check_cek_length.js":
/*!**************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/check_cek_length.js ***!
  \**************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

const checkCekLength = (cek, expected) => {
    const actual = cek.byteLength << 3;
    if (actual !== expected) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWEInvalid(`Invalid Content Encryption Key length. Expected ${expected} bits, got ${actual} bits`);
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (checkCekLength);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/check_key_length.js":
/*!**************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/check_key_length.js ***!
  \**************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((alg, key) => {
    if (alg.startsWith('RS') || alg.startsWith('PS')) {
        const { modulusLength } = key.algorithm;
        if (typeof modulusLength !== 'number' || modulusLength < 2048) {
            throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
        }
    }
});


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/decrypt.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/decrypt.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_check_iv_length_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/check_iv_length.js */ "../core/node_modules/jose/dist/browser/lib/check_iv_length.js");
/* harmony import */ var _check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./check_cek_length.js */ "../core/node_modules/jose/dist/browser/runtime/check_cek_length.js");
/* harmony import */ var _timing_safe_equal_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./timing_safe_equal.js */ "../core/node_modules/jose/dist/browser/runtime/timing_safe_equal.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");









async function cbcDecrypt(enc, cek, ciphertext, iv, tag, aad) {
    if (!(cek instanceof Uint8Array)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_7__["default"])(cek, 'Uint8Array'));
    }
    const keySize = parseInt(enc.slice(1, 4), 10);
    const encKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.importKey('raw', cek.subarray(keySize >> 3), 'AES-CBC', false, ['decrypt']);
    const macKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.importKey('raw', cek.subarray(0, keySize >> 3), {
        hash: `SHA-${keySize << 1}`,
        name: 'HMAC',
    }, false, ['sign']);
    const macData = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.concat)(aad, iv, ciphertext, (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.uint64be)(aad.length << 3));
    const expectedTag = new Uint8Array((await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.sign('HMAC', macKey, macData)).slice(0, keySize >> 3));
    let macCheckPassed;
    try {
        macCheckPassed = (0,_timing_safe_equal_js__WEBPACK_IMPORTED_MODULE_3__["default"])(tag, expectedTag);
    }
    catch (_a) {
    }
    if (!macCheckPassed) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_4__.JWEDecryptionFailed();
    }
    let plaintext;
    try {
        plaintext = new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.decrypt({ iv, name: 'AES-CBC' }, encKey, ciphertext));
    }
    catch (_b) {
    }
    if (!plaintext) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_4__.JWEDecryptionFailed();
    }
    return plaintext;
}
async function gcmDecrypt(enc, cek, ciphertext, iv, tag, aad) {
    let encKey;
    if (cek instanceof Uint8Array) {
        encKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    }
    else {
        (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_6__.checkEncCryptoKey)(cek, enc, 'decrypt');
        encKey = cek;
    }
    try {
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.decrypt({
            additionalData: aad,
            iv,
            name: 'AES-GCM',
            tagLength: 128,
        }, encKey, (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.concat)(ciphertext, tag)));
    }
    catch (_a) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_4__.JWEDecryptionFailed();
    }
}
const decrypt = async (enc, cek, ciphertext, iv, tag, aad) => {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_5__.isCryptoKey)(cek) && !(cek instanceof Uint8Array)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_7__["default"])(cek, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_8__.types, 'Uint8Array'));
    }
    (0,_lib_check_iv_length_js__WEBPACK_IMPORTED_MODULE_1__["default"])(enc, iv);
    switch (enc) {
        case 'A128CBC-HS256':
        case 'A192CBC-HS384':
        case 'A256CBC-HS512':
            if (cek instanceof Uint8Array)
                (0,_check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(cek, parseInt(enc.slice(-3), 10));
            return cbcDecrypt(enc, cek, ciphertext, iv, tag, aad);
        case 'A128GCM':
        case 'A192GCM':
        case 'A256GCM':
            if (cek instanceof Uint8Array)
                (0,_check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(cek, parseInt(enc.slice(1, 4), 10));
            return gcmDecrypt(enc, cek, ciphertext, iv, tag, aad);
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_4__.JOSENotSupported('Unsupported JWE Content Encryption Algorithm');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (decrypt);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/digest.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/digest.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");

const digest = async (algorithm, data) => {
    const subtleDigest = `SHA-${algorithm.slice(-3)}`;
    return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__["default"].subtle.digest(subtleDigest, data));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (digest);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/ecdhes.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/ecdhes.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "deriveKey": () => (/* binding */ deriveKey),
/* harmony export */   "ecdhAllowed": () => (/* binding */ ecdhAllowed),
/* harmony export */   "generateEpk": () => (/* binding */ generateEpk)
/* harmony export */ });
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");





async function deriveKey(publicKey, privateKey, algorithm, keyLength, apu = new Uint8Array(0), apv = new Uint8Array(0)) {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(publicKey)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__["default"])(publicKey, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_4__.types));
    }
    (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_2__.checkEncCryptoKey)(publicKey, 'ECDH');
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(privateKey)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__["default"])(privateKey, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_4__.types));
    }
    (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_2__.checkEncCryptoKey)(privateKey, 'ECDH', 'deriveBits');
    const value = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.concat)((0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.lengthAndInput)(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.encoder.encode(algorithm)), (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.lengthAndInput)(apu), (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.lengthAndInput)(apv), (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.uint32be)(keyLength));
    let length;
    if (publicKey.algorithm.name === 'X25519') {
        length = 256;
    }
    else if (publicKey.algorithm.name === 'X448') {
        length = 448;
    }
    else {
        length =
            Math.ceil(parseInt(publicKey.algorithm.namedCurve.substr(-3), 10) / 8) << 3;
    }
    const sharedSecret = new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.deriveBits({
        name: publicKey.algorithm.name,
        public: publicKey,
    }, privateKey, length));
    return (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.concatKdf)(sharedSecret, keyLength, value);
}
async function generateEpk(key) {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_4__.types));
    }
    return _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.generateKey(key.algorithm, true, ['deriveBits']);
}
function ecdhAllowed(key) {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_1__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_3__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_4__.types));
    }
    return (['P-256', 'P-384', 'P-521'].includes(key.algorithm.namedCurve) ||
        key.algorithm.name === 'X25519' ||
        key.algorithm.name === 'X448');
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/encrypt.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/encrypt.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_check_iv_length_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/check_iv_length.js */ "../core/node_modules/jose/dist/browser/lib/check_iv_length.js");
/* harmony import */ var _check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./check_cek_length.js */ "../core/node_modules/jose/dist/browser/runtime/check_cek_length.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");








async function cbcEncrypt(enc, plaintext, cek, iv, aad) {
    if (!(cek instanceof Uint8Array)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__["default"])(cek, 'Uint8Array'));
    }
    const keySize = parseInt(enc.slice(1, 4), 10);
    const encKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.importKey('raw', cek.subarray(keySize >> 3), 'AES-CBC', false, ['encrypt']);
    const macKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.importKey('raw', cek.subarray(0, keySize >> 3), {
        hash: `SHA-${keySize << 1}`,
        name: 'HMAC',
    }, false, ['sign']);
    const ciphertext = new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.encrypt({
        iv,
        name: 'AES-CBC',
    }, encKey, plaintext));
    const macData = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.concat)(aad, iv, ciphertext, (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_0__.uint64be)(aad.length << 3));
    const tag = new Uint8Array((await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.sign('HMAC', macKey, macData)).slice(0, keySize >> 3));
    return { ciphertext, tag };
}
async function gcmEncrypt(enc, plaintext, cek, iv, aad) {
    let encKey;
    if (cek instanceof Uint8Array) {
        encKey = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    }
    else {
        (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_4__.checkEncCryptoKey)(cek, enc, 'encrypt');
        encKey = cek;
    }
    const encrypted = new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_3__["default"].subtle.encrypt({
        additionalData: aad,
        iv,
        name: 'AES-GCM',
        tagLength: 128,
    }, encKey, plaintext));
    const tag = encrypted.slice(-16);
    const ciphertext = encrypted.slice(0, -16);
    return { ciphertext, tag };
}
const encrypt = async (enc, plaintext, cek, iv, aad) => {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_3__.isCryptoKey)(cek) && !(cek instanceof Uint8Array)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__["default"])(cek, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_7__.types, 'Uint8Array'));
    }
    (0,_lib_check_iv_length_js__WEBPACK_IMPORTED_MODULE_1__["default"])(enc, iv);
    switch (enc) {
        case 'A128CBC-HS256':
        case 'A192CBC-HS384':
        case 'A256CBC-HS512':
            if (cek instanceof Uint8Array)
                (0,_check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(cek, parseInt(enc.slice(-3), 10));
            return cbcEncrypt(enc, plaintext, cek, iv, aad);
        case 'A128GCM':
        case 'A192GCM':
        case 'A256GCM':
            if (cek instanceof Uint8Array)
                (0,_check_cek_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(cek, parseInt(enc.slice(1, 4), 10));
            return gcmEncrypt(enc, plaintext, cek, iv, aad);
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_6__.JOSENotSupported('Unsupported JWE Content Encryption Algorithm');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (encrypt);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/env.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/env.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isCloudflareWorkers": () => (/* binding */ isCloudflareWorkers)
/* harmony export */ });
function isCloudflareWorkers() {
    return (typeof WebSocketPair !== 'undefined' ||
        (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
        (typeof EdgeRuntime !== 'undefined' && EdgeRuntime === 'vercel'));
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/fetch_jwks.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/fetch_jwks.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

const fetchJwks = async (url, timeout, options) => {
    let controller;
    let id;
    let timedOut = false;
    if (typeof AbortController === 'function') {
        controller = new AbortController();
        id = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);
    }
    const response = await fetch(url.href, {
        signal: controller ? controller.signal : undefined,
        redirect: 'manual',
        headers: options.headers,
    }).catch((err) => {
        if (timedOut)
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JWKSTimeout();
        throw err;
    });
    if (id !== undefined)
        clearTimeout(id);
    if (response.status !== 200) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response');
    }
    try {
        return await response.json();
    }
    catch (_a) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSEError('Failed to parse the JSON Web Key Set HTTP response as JSON');
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (fetchJwks);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/generate.js":
/*!******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/generate.js ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "generateKeyPair": () => (/* binding */ generateKeyPair),
/* harmony export */   "generateSecret": () => (/* binding */ generateSecret)
/* harmony export */ });
/* harmony import */ var _env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _random_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./random.js */ "../core/node_modules/jose/dist/browser/runtime/random.js");




async function generateSecret(alg, options) {
    var _a;
    let length;
    let algorithm;
    let keyUsages;
    switch (alg) {
        case 'HS256':
        case 'HS384':
        case 'HS512':
            length = parseInt(alg.slice(-3), 10);
            algorithm = { name: 'HMAC', hash: `SHA-${length}`, length };
            keyUsages = ['sign', 'verify'];
            break;
        case 'A128CBC-HS256':
        case 'A192CBC-HS384':
        case 'A256CBC-HS512':
            length = parseInt(alg.slice(-3), 10);
            return (0,_random_js__WEBPACK_IMPORTED_MODULE_3__["default"])(new Uint8Array(length >> 3));
        case 'A128KW':
        case 'A192KW':
        case 'A256KW':
            length = parseInt(alg.slice(1, 4), 10);
            algorithm = { name: 'AES-KW', length };
            keyUsages = ['wrapKey', 'unwrapKey'];
            break;
        case 'A128GCMKW':
        case 'A192GCMKW':
        case 'A256GCMKW':
        case 'A128GCM':
        case 'A192GCM':
        case 'A256GCM':
            length = parseInt(alg.slice(1, 4), 10);
            algorithm = { name: 'AES-GCM', length };
            keyUsages = ['encrypt', 'decrypt'];
            break;
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
    }
    return _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.generateKey(algorithm, (_a = options === null || options === void 0 ? void 0 : options.extractable) !== null && _a !== void 0 ? _a : false, keyUsages);
}
function getModulusLengthOption(options) {
    var _a;
    const modulusLength = (_a = options === null || options === void 0 ? void 0 : options.modulusLength) !== null && _a !== void 0 ? _a : 2048;
    if (typeof modulusLength !== 'number' || modulusLength < 2048) {
        throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported modulusLength option provided, 2048 bits or larger keys must be used');
    }
    return modulusLength;
}
async function generateKeyPair(alg, options) {
    var _a, _b, _c, _d;
    let algorithm;
    let keyUsages;
    switch (alg) {
        case 'PS256':
        case 'PS384':
        case 'PS512':
            algorithm = {
                name: 'RSA-PSS',
                hash: `SHA-${alg.slice(-3)}`,
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                modulusLength: getModulusLengthOption(options),
            };
            keyUsages = ['sign', 'verify'];
            break;
        case 'RS256':
        case 'RS384':
        case 'RS512':
            algorithm = {
                name: 'RSASSA-PKCS1-v1_5',
                hash: `SHA-${alg.slice(-3)}`,
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                modulusLength: getModulusLengthOption(options),
            };
            keyUsages = ['sign', 'verify'];
            break;
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512':
            algorithm = {
                name: 'RSA-OAEP',
                hash: `SHA-${parseInt(alg.slice(-3), 10) || 1}`,
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                modulusLength: getModulusLengthOption(options),
            };
            keyUsages = ['decrypt', 'unwrapKey', 'encrypt', 'wrapKey'];
            break;
        case 'ES256':
            algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
            keyUsages = ['sign', 'verify'];
            break;
        case 'ES384':
            algorithm = { name: 'ECDSA', namedCurve: 'P-384' };
            keyUsages = ['sign', 'verify'];
            break;
        case 'ES512':
            algorithm = { name: 'ECDSA', namedCurve: 'P-521' };
            keyUsages = ['sign', 'verify'];
            break;
        case 'EdDSA':
            keyUsages = ['sign', 'verify'];
            const crv = (_a = options === null || options === void 0 ? void 0 : options.crv) !== null && _a !== void 0 ? _a : 'Ed25519';
            switch (crv) {
                case 'Ed25519':
                case 'Ed448':
                    algorithm = { name: crv };
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported crv option provided');
            }
            break;
        case 'ECDH-ES':
        case 'ECDH-ES+A128KW':
        case 'ECDH-ES+A192KW':
        case 'ECDH-ES+A256KW': {
            keyUsages = ['deriveKey', 'deriveBits'];
            const crv = (_b = options === null || options === void 0 ? void 0 : options.crv) !== null && _b !== void 0 ? _b : 'P-256';
            switch (crv) {
                case 'P-256':
                case 'P-384':
                case 'P-521': {
                    algorithm = { name: 'ECDH', namedCurve: crv };
                    break;
                }
                case 'X25519':
                case 'X448':
                    algorithm = { name: crv };
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported crv option provided, supported values are P-256, P-384, P-521, X25519, and X448');
            }
            break;
        }
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
    }
    try {
        return (await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.generateKey(algorithm, (_c = options === null || options === void 0 ? void 0 : options.extractable) !== null && _c !== void 0 ? _c : false, keyUsages));
    }
    catch (err) {
        if (algorithm.name === 'Ed25519' &&
            (err === null || err === void 0 ? void 0 : err.name) === 'NotSupportedError' &&
            (0,_env_js__WEBPACK_IMPORTED_MODULE_0__.isCloudflareWorkers)()) {
            algorithm = { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' };
            return (await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.generateKey(algorithm, (_d = options === null || options === void 0 ? void 0 : options.extractable) !== null && _d !== void 0 ? _d : false, keyUsages));
        }
        throw err;
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/get_sign_verify_key.js":
/*!*****************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/get_sign_verify_key.js ***!
  \*****************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getCryptoKey)
/* harmony export */ });
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");




function getCryptoKey(alg, key, usage) {
    if ((0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_0__.isCryptoKey)(key)) {
        (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_1__.checkSigCryptoKey)(key, alg, usage);
        return key;
    }
    if (key instanceof Uint8Array) {
        if (!alg.startsWith('HS')) {
            throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_2__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_3__.types));
        }
        return _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__["default"].subtle.importKey('raw', key, { hash: `SHA-${alg.slice(-3)}`, name: 'HMAC' }, false, [usage]);
    }
    throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_2__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_3__.types, 'Uint8Array'));
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js":
/*!*********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/is_key_like.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "types": () => (/* binding */ types)
/* harmony export */ });
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((key) => {
    return (0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_0__.isCryptoKey)(key);
});
const types = ['CryptoKey'];


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/jwk_to_key.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/jwk_to_key.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");




function subtleMapping(jwk) {
    let algorithm;
    let keyUsages;
    switch (jwk.kty) {
        case 'oct': {
            switch (jwk.alg) {
                case 'HS256':
                case 'HS384':
                case 'HS512':
                    algorithm = { name: 'HMAC', hash: `SHA-${jwk.alg.slice(-3)}` };
                    keyUsages = ['sign', 'verify'];
                    break;
                case 'A128CBC-HS256':
                case 'A192CBC-HS384':
                case 'A256CBC-HS512':
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported(`${jwk.alg} keys cannot be imported as CryptoKey instances`);
                case 'A128GCM':
                case 'A192GCM':
                case 'A256GCM':
                case 'A128GCMKW':
                case 'A192GCMKW':
                case 'A256GCMKW':
                    algorithm = { name: 'AES-GCM' };
                    keyUsages = ['encrypt', 'decrypt'];
                    break;
                case 'A128KW':
                case 'A192KW':
                case 'A256KW':
                    algorithm = { name: 'AES-KW' };
                    keyUsages = ['wrapKey', 'unwrapKey'];
                    break;
                case 'PBES2-HS256+A128KW':
                case 'PBES2-HS384+A192KW':
                case 'PBES2-HS512+A256KW':
                    algorithm = { name: 'PBKDF2' };
                    keyUsages = ['deriveBits'];
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
            }
            break;
        }
        case 'RSA': {
            switch (jwk.alg) {
                case 'PS256':
                case 'PS384':
                case 'PS512':
                    algorithm = { name: 'RSA-PSS', hash: `SHA-${jwk.alg.slice(-3)}` };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'RS256':
                case 'RS384':
                case 'RS512':
                    algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: `SHA-${jwk.alg.slice(-3)}` };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'RSA-OAEP':
                case 'RSA-OAEP-256':
                case 'RSA-OAEP-384':
                case 'RSA-OAEP-512':
                    algorithm = {
                        name: 'RSA-OAEP',
                        hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`,
                    };
                    keyUsages = jwk.d ? ['decrypt', 'unwrapKey'] : ['encrypt', 'wrapKey'];
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
            }
            break;
        }
        case 'EC': {
            switch (jwk.alg) {
                case 'ES256':
                    algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'ES384':
                    algorithm = { name: 'ECDSA', namedCurve: 'P-384' };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'ES512':
                    algorithm = { name: 'ECDSA', namedCurve: 'P-521' };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'ECDH-ES':
                case 'ECDH-ES+A128KW':
                case 'ECDH-ES+A192KW':
                case 'ECDH-ES+A256KW':
                    algorithm = { name: 'ECDH', namedCurve: jwk.crv };
                    keyUsages = jwk.d ? ['deriveBits'] : [];
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
            }
            break;
        }
        case 'OKP': {
            switch (jwk.alg) {
                case 'EdDSA':
                    algorithm = { name: jwk.crv };
                    keyUsages = jwk.d ? ['sign'] : ['verify'];
                    break;
                case 'ECDH-ES':
                case 'ECDH-ES+A128KW':
                case 'ECDH-ES+A192KW':
                case 'ECDH-ES+A256KW':
                    algorithm = { name: jwk.crv };
                    keyUsages = jwk.d ? ['deriveBits'] : [];
                    break;
                default:
                    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
            }
            break;
        }
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_2__.JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
    }
    return { algorithm, keyUsages };
}
const parse = async (jwk) => {
    var _a, _b;
    if (!jwk.alg) {
        throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
    }
    const { algorithm, keyUsages } = subtleMapping(jwk);
    const rest = [
        algorithm,
        (_a = jwk.ext) !== null && _a !== void 0 ? _a : false,
        (_b = jwk.key_ops) !== null && _b !== void 0 ? _b : keyUsages,
    ];
    if (algorithm.name === 'PBKDF2') {
        return _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey('raw', (0,_base64url_js__WEBPACK_IMPORTED_MODULE_3__.decode)(jwk.k), ...rest);
    }
    const keyData = { ...jwk };
    delete keyData.alg;
    delete keyData.use;
    try {
        return await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey('jwk', keyData, ...rest);
    }
    catch (err) {
        if (algorithm.name === 'Ed25519' &&
            (err === null || err === void 0 ? void 0 : err.name) === 'NotSupportedError' &&
            (0,_env_js__WEBPACK_IMPORTED_MODULE_0__.isCloudflareWorkers)()) {
            rest[0] = { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' };
            return await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.importKey('jwk', keyData, ...rest);
        }
        throw err;
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (parse);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/key_to_jwk.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/key_to_jwk.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");




const keyToJWK = async (key) => {
    if (key instanceof Uint8Array) {
        return {
            kty: 'oct',
            k: (0,_base64url_js__WEBPACK_IMPORTED_MODULE_2__.encode)(key),
        };
    }
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_0__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_1__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_3__.types, 'Uint8Array'));
    }
    if (!key.extractable) {
        throw new TypeError('non-extractable CryptoKey cannot be exported as a JWK');
    }
    const { ext, key_ops, alg, use, ...jwk } = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__["default"].subtle.exportKey('jwk', key);
    return jwk;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (keyToJWK);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/pbes2kw.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/pbes2kw.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decrypt": () => (/* binding */ decrypt),
/* harmony export */   "encrypt": () => (/* binding */ encrypt)
/* harmony export */ });
/* harmony import */ var _random_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./random.js */ "../core/node_modules/jose/dist/browser/runtime/random.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");
/* harmony import */ var _aeskw_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./aeskw.js */ "../core/node_modules/jose/dist/browser/runtime/aeskw.js");
/* harmony import */ var _lib_check_p2s_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/check_p2s.js */ "../core/node_modules/jose/dist/browser/lib/check_p2s.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");









function getCryptoKey(key, alg) {
    if (key instanceof Uint8Array) {
        return _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.importKey('raw', key, 'PBKDF2', false, ['deriveBits']);
    }
    if ((0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_5__.isCryptoKey)(key)) {
        (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_6__.checkEncCryptoKey)(key, alg, 'deriveBits', 'deriveKey');
        return key;
    }
    throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_7__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_8__.types, 'Uint8Array'));
}
async function deriveKey(p2s, alg, p2c, key) {
    (0,_lib_check_p2s_js__WEBPACK_IMPORTED_MODULE_4__["default"])(p2s);
    const salt = (0,_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.p2s)(alg, p2s);
    const keylen = parseInt(alg.slice(13, 16), 10);
    const subtleAlg = {
        hash: `SHA-${alg.slice(8, 11)}`,
        iterations: p2c,
        name: 'PBKDF2',
        salt,
    };
    const wrapAlg = {
        length: keylen,
        name: 'AES-KW',
    };
    const cryptoKey = await getCryptoKey(key, alg);
    if (cryptoKey.usages.includes('deriveBits')) {
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.deriveBits(subtleAlg, cryptoKey, keylen));
    }
    if (cryptoKey.usages.includes('deriveKey')) {
        return _webcrypto_js__WEBPACK_IMPORTED_MODULE_5__["default"].subtle.deriveKey(subtleAlg, cryptoKey, wrapAlg, false, ['wrapKey', 'unwrapKey']);
    }
    throw new TypeError('PBKDF2 key "usages" must include "deriveBits" or "deriveKey"');
}
const encrypt = async (alg, key, cek, p2c = 2048, p2s = (0,_random_js__WEBPACK_IMPORTED_MODULE_0__["default"])(new Uint8Array(16))) => {
    const derived = await deriveKey(p2s, alg, p2c, key);
    const encryptedKey = await (0,_aeskw_js__WEBPACK_IMPORTED_MODULE_3__.wrap)(alg.slice(-6), derived, cek);
    return { encryptedKey, p2c, p2s: (0,_base64url_js__WEBPACK_IMPORTED_MODULE_2__.encode)(p2s) };
};
const decrypt = async (alg, key, encryptedKey, p2c, p2s) => {
    const derived = await deriveKey(p2s, alg, p2c, key);
    return (0,_aeskw_js__WEBPACK_IMPORTED_MODULE_3__.unwrap)(alg.slice(-6), derived, encryptedKey);
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/random.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/random.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_webcrypto_js__WEBPACK_IMPORTED_MODULE_0__["default"].getRandomValues.bind(_webcrypto_js__WEBPACK_IMPORTED_MODULE_0__["default"]));


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/rsaes.js":
/*!***************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/rsaes.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decrypt": () => (/* binding */ decrypt),
/* harmony export */   "encrypt": () => (/* binding */ encrypt)
/* harmony export */ });
/* harmony import */ var _subtle_rsaes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./subtle_rsaes.js */ "../core/node_modules/jose/dist/browser/runtime/subtle_rsaes.js");
/* harmony import */ var _bogus_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./bogus.js */ "../core/node_modules/jose/dist/browser/runtime/bogus.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/crypto_key.js */ "../core/node_modules/jose/dist/browser/lib/crypto_key.js");
/* harmony import */ var _check_key_length_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./check_key_length.js */ "../core/node_modules/jose/dist/browser/runtime/check_key_length.js");
/* harmony import */ var _lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/invalid_key_input.js */ "../core/node_modules/jose/dist/browser/lib/invalid_key_input.js");
/* harmony import */ var _is_key_like_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./is_key_like.js */ "../core/node_modules/jose/dist/browser/runtime/is_key_like.js");







const encrypt = async (alg, key, cek) => {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_2__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_6__.types));
    }
    (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_3__.checkEncCryptoKey)(key, alg, 'encrypt', 'wrapKey');
    (0,_check_key_length_js__WEBPACK_IMPORTED_MODULE_4__["default"])(alg, key);
    if (key.usages.includes('encrypt')) {
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.encrypt((0,_subtle_rsaes_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg), key, cek));
    }
    if (key.usages.includes('wrapKey')) {
        const cryptoKeyCek = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.importKey('raw', cek, ..._bogus_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.wrapKey('raw', cryptoKeyCek, key, (0,_subtle_rsaes_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg)));
    }
    throw new TypeError('RSA-OAEP key "usages" must include "encrypt" or "wrapKey" for this operation');
};
const decrypt = async (alg, key, encryptedKey) => {
    if (!(0,_webcrypto_js__WEBPACK_IMPORTED_MODULE_2__.isCryptoKey)(key)) {
        throw new TypeError((0,_lib_invalid_key_input_js__WEBPACK_IMPORTED_MODULE_5__["default"])(key, ..._is_key_like_js__WEBPACK_IMPORTED_MODULE_6__.types));
    }
    (0,_lib_crypto_key_js__WEBPACK_IMPORTED_MODULE_3__.checkEncCryptoKey)(key, alg, 'decrypt', 'unwrapKey');
    (0,_check_key_length_js__WEBPACK_IMPORTED_MODULE_4__["default"])(alg, key);
    if (key.usages.includes('decrypt')) {
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.decrypt((0,_subtle_rsaes_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg), key, encryptedKey));
    }
    if (key.usages.includes('unwrapKey')) {
        const cryptoKeyCek = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.unwrapKey('raw', encryptedKey, key, (0,_subtle_rsaes_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg), ..._bogus_js__WEBPACK_IMPORTED_MODULE_1__["default"]);
        return new Uint8Array(await _webcrypto_js__WEBPACK_IMPORTED_MODULE_2__["default"].subtle.exportKey('raw', cryptoKeyCek));
    }
    throw new TypeError('RSA-OAEP key "usages" must include "decrypt" or "unwrapKey" for this operation');
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/sign.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/sign.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _subtle_dsa_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./subtle_dsa.js */ "../core/node_modules/jose/dist/browser/runtime/subtle_dsa.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _check_key_length_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./check_key_length.js */ "../core/node_modules/jose/dist/browser/runtime/check_key_length.js");
/* harmony import */ var _get_sign_verify_key_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./get_sign_verify_key.js */ "../core/node_modules/jose/dist/browser/runtime/get_sign_verify_key.js");




const sign = async (alg, key, data) => {
    const cryptoKey = await (0,_get_sign_verify_key_js__WEBPACK_IMPORTED_MODULE_3__["default"])(alg, key, 'sign');
    (0,_check_key_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(alg, cryptoKey);
    const signature = await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.sign((0,_subtle_dsa_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg, cryptoKey.algorithm), cryptoKey, data);
    return new Uint8Array(signature);
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (sign);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/subtle_dsa.js":
/*!********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/subtle_dsa.js ***!
  \********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ subtleDsa)
/* harmony export */ });
/* harmony import */ var _env_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./env.js */ "../core/node_modules/jose/dist/browser/runtime/env.js");
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");


function subtleDsa(alg, algorithm) {
    const hash = `SHA-${alg.slice(-3)}`;
    switch (alg) {
        case 'HS256':
        case 'HS384':
        case 'HS512':
            return { hash, name: 'HMAC' };
        case 'PS256':
        case 'PS384':
        case 'PS512':
            return { hash, name: 'RSA-PSS', saltLength: alg.slice(-3) >> 3 };
        case 'RS256':
        case 'RS384':
        case 'RS512':
            return { hash, name: 'RSASSA-PKCS1-v1_5' };
        case 'ES256':
        case 'ES384':
        case 'ES512':
            return { hash, name: 'ECDSA', namedCurve: algorithm.namedCurve };
        case 'EdDSA':
            if ((0,_env_js__WEBPACK_IMPORTED_MODULE_0__.isCloudflareWorkers)() && algorithm.name === 'NODE-ED25519') {
                return { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' };
            }
            return { name: algorithm.name };
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_1__.JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/subtle_rsaes.js":
/*!**********************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/subtle_rsaes.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ subtleRsaEs)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

function subtleRsaEs(alg) {
    switch (alg) {
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512':
            return 'RSA-OAEP';
        default:
            throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/timing_safe_equal.js":
/*!***************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/timing_safe_equal.js ***!
  \***************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
const timingSafeEqual = (a, b) => {
    if (!(a instanceof Uint8Array)) {
        throw new TypeError('First argument must be a buffer');
    }
    if (!(b instanceof Uint8Array)) {
        throw new TypeError('Second argument must be a buffer');
    }
    if (a.length !== b.length) {
        throw new TypeError('Input buffers must have the same length');
    }
    const len = a.length;
    let out = 0;
    let i = -1;
    while (++i < len) {
        out |= a[i] ^ b[i];
    }
    return out === 0;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (timingSafeEqual);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/verify.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/verify.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _subtle_dsa_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./subtle_dsa.js */ "../core/node_modules/jose/dist/browser/runtime/subtle_dsa.js");
/* harmony import */ var _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./webcrypto.js */ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js");
/* harmony import */ var _check_key_length_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./check_key_length.js */ "../core/node_modules/jose/dist/browser/runtime/check_key_length.js");
/* harmony import */ var _get_sign_verify_key_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./get_sign_verify_key.js */ "../core/node_modules/jose/dist/browser/runtime/get_sign_verify_key.js");




const verify = async (alg, key, signature, data) => {
    const cryptoKey = await (0,_get_sign_verify_key_js__WEBPACK_IMPORTED_MODULE_3__["default"])(alg, key, 'verify');
    (0,_check_key_length_js__WEBPACK_IMPORTED_MODULE_2__["default"])(alg, cryptoKey);
    const algorithm = (0,_subtle_dsa_js__WEBPACK_IMPORTED_MODULE_0__["default"])(alg, cryptoKey.algorithm);
    try {
        return await _webcrypto_js__WEBPACK_IMPORTED_MODULE_1__["default"].subtle.verify(algorithm, cryptoKey, signature, data);
    }
    catch (_a) {
        return false;
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (verify);


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/webcrypto.js":
/*!*******************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/webcrypto.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "isCryptoKey": () => (/* binding */ isCryptoKey)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (crypto);
const isCryptoKey = (key) => key instanceof CryptoKey;


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/runtime/zlib.js":
/*!**************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/runtime/zlib.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "deflate": () => (/* binding */ deflate),
/* harmony export */   "inflate": () => (/* binding */ inflate)
/* harmony export */ });
/* harmony import */ var _util_errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../util/errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");

const inflate = async () => {
    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported('JWE "zip" (Compression Algorithm) Header Parameter is not supported by your javascript runtime. You need to use the `inflateRaw` decrypt option to provide Inflate Raw implementation.');
};
const deflate = async () => {
    throw new _util_errors_js__WEBPACK_IMPORTED_MODULE_0__.JOSENotSupported('JWE "zip" (Compression Algorithm) Header Parameter is not supported by your javascript runtime. You need to use the `deflateRaw` encrypt option to provide Deflate Raw implementation.');
};


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/util/base64url.js":
/*!****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/util/base64url.js ***!
  \****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decode": () => (/* binding */ decode),
/* harmony export */   "encode": () => (/* binding */ encode)
/* harmony export */ });
/* harmony import */ var _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../runtime/base64url.js */ "../core/node_modules/jose/dist/browser/runtime/base64url.js");

const encode = _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.encode;
const decode = _runtime_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode;


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/util/decode_jwt.js":
/*!*****************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/util/decode_jwt.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decodeJwt": () => (/* binding */ decodeJwt)
/* harmony export */ });
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/util/base64url.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");
/* harmony import */ var _errors_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./errors.js */ "../core/node_modules/jose/dist/browser/util/errors.js");




function decodeJwt(jwt) {
    if (typeof jwt !== 'string')
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('JWTs must use Compact JWS serialization, JWT must be a string');
    const { 1: payload, length } = jwt.split('.');
    if (length === 5)
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('Only JWTs using Compact JWS serialization can be decoded');
    if (length !== 3)
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('Invalid JWT');
    if (!payload)
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('JWTs must contain a payload');
    let decoded;
    try {
        decoded = (0,_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(payload);
    }
    catch (_a) {
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('Failed to parse the base64url encoded payload');
    }
    let result;
    try {
        result = JSON.parse(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.decoder.decode(decoded));
    }
    catch (_b) {
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('Failed to parse the decoded payload as JSON');
    }
    if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])(result))
        throw new _errors_js__WEBPACK_IMPORTED_MODULE_3__.JWTInvalid('Invalid JWT Claims Set');
    return result;
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/util/decode_protected_header.js":
/*!******************************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/util/decode_protected_header.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decodeProtectedHeader": () => (/* binding */ decodeProtectedHeader)
/* harmony export */ });
/* harmony import */ var _base64url_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base64url.js */ "../core/node_modules/jose/dist/browser/util/base64url.js");
/* harmony import */ var _lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/buffer_utils.js */ "../core/node_modules/jose/dist/browser/lib/buffer_utils.js");
/* harmony import */ var _lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/is_object.js */ "../core/node_modules/jose/dist/browser/lib/is_object.js");



function decodeProtectedHeader(token) {
    let protectedB64u;
    if (typeof token === 'string') {
        const parts = token.split('.');
        if (parts.length === 3 || parts.length === 5) {
            ;
            [protectedB64u] = parts;
        }
    }
    else if (typeof token === 'object' && token) {
        if ('protected' in token) {
            protectedB64u = token.protected;
        }
        else {
            throw new TypeError('Token does not contain a Protected Header');
        }
    }
    try {
        if (typeof protectedB64u !== 'string' || !protectedB64u) {
            throw new Error();
        }
        const result = JSON.parse(_lib_buffer_utils_js__WEBPACK_IMPORTED_MODULE_1__.decoder.decode((0,_base64url_js__WEBPACK_IMPORTED_MODULE_0__.decode)(protectedB64u)));
        if (!(0,_lib_is_object_js__WEBPACK_IMPORTED_MODULE_2__["default"])(result)) {
            throw new Error();
        }
        return result;
    }
    catch (_a) {
        throw new TypeError('Invalid Token or Protected Header formatting');
    }
}


/***/ }),

/***/ "../core/node_modules/jose/dist/browser/util/errors.js":
/*!*************************************************************!*\
  !*** ../core/node_modules/jose/dist/browser/util/errors.js ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "JOSEAlgNotAllowed": () => (/* binding */ JOSEAlgNotAllowed),
/* harmony export */   "JOSEError": () => (/* binding */ JOSEError),
/* harmony export */   "JOSENotSupported": () => (/* binding */ JOSENotSupported),
/* harmony export */   "JWEDecryptionFailed": () => (/* binding */ JWEDecryptionFailed),
/* harmony export */   "JWEInvalid": () => (/* binding */ JWEInvalid),
/* harmony export */   "JWKInvalid": () => (/* binding */ JWKInvalid),
/* harmony export */   "JWKSInvalid": () => (/* binding */ JWKSInvalid),
/* harmony export */   "JWKSMultipleMatchingKeys": () => (/* binding */ JWKSMultipleMatchingKeys),
/* harmony export */   "JWKSNoMatchingKey": () => (/* binding */ JWKSNoMatchingKey),
/* harmony export */   "JWKSTimeout": () => (/* binding */ JWKSTimeout),
/* harmony export */   "JWSInvalid": () => (/* binding */ JWSInvalid),
/* harmony export */   "JWSSignatureVerificationFailed": () => (/* binding */ JWSSignatureVerificationFailed),
/* harmony export */   "JWTClaimValidationFailed": () => (/* binding */ JWTClaimValidationFailed),
/* harmony export */   "JWTExpired": () => (/* binding */ JWTExpired),
/* harmony export */   "JWTInvalid": () => (/* binding */ JWTInvalid)
/* harmony export */ });
class JOSEError extends Error {
    static get code() {
        return 'ERR_JOSE_GENERIC';
    }
    constructor(message) {
        var _a;
        super(message);
        this.code = 'ERR_JOSE_GENERIC';
        this.name = this.constructor.name;
        (_a = Error.captureStackTrace) === null || _a === void 0 ? void 0 : _a.call(Error, this, this.constructor);
    }
}
class JWTClaimValidationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    }
    constructor(message, claim = 'unspecified', reason = 'unspecified') {
        super(message);
        this.code = 'ERR_JWT_CLAIM_VALIDATION_FAILED';
        this.claim = claim;
        this.reason = reason;
    }
}
class JWTExpired extends JOSEError {
    static get code() {
        return 'ERR_JWT_EXPIRED';
    }
    constructor(message, claim = 'unspecified', reason = 'unspecified') {
        super(message);
        this.code = 'ERR_JWT_EXPIRED';
        this.claim = claim;
        this.reason = reason;
    }
}
class JOSEAlgNotAllowed extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JOSE_ALG_NOT_ALLOWED';
    }
    static get code() {
        return 'ERR_JOSE_ALG_NOT_ALLOWED';
    }
}
class JOSENotSupported extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JOSE_NOT_SUPPORTED';
    }
    static get code() {
        return 'ERR_JOSE_NOT_SUPPORTED';
    }
}
class JWEDecryptionFailed extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWE_DECRYPTION_FAILED';
        this.message = 'decryption operation failed';
    }
    static get code() {
        return 'ERR_JWE_DECRYPTION_FAILED';
    }
}
class JWEInvalid extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWE_INVALID';
    }
    static get code() {
        return 'ERR_JWE_INVALID';
    }
}
class JWSInvalid extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWS_INVALID';
    }
    static get code() {
        return 'ERR_JWS_INVALID';
    }
}
class JWTInvalid extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWT_INVALID';
    }
    static get code() {
        return 'ERR_JWT_INVALID';
    }
}
class JWKInvalid extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWK_INVALID';
    }
    static get code() {
        return 'ERR_JWK_INVALID';
    }
}
class JWKSInvalid extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWKS_INVALID';
    }
    static get code() {
        return 'ERR_JWKS_INVALID';
    }
}
class JWKSNoMatchingKey extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWKS_NO_MATCHING_KEY';
        this.message = 'no applicable key found in the JSON Web Key Set';
    }
    static get code() {
        return 'ERR_JWKS_NO_MATCHING_KEY';
    }
}
class JWKSMultipleMatchingKeys extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
        this.message = 'multiple matching keys found in the JSON Web Key Set';
    }
    static get code() {
        return 'ERR_JWKS_MULTIPLE_MATCHING_KEYS';
    }
}
Symbol.asyncIterator;
class JWKSTimeout extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWKS_TIMEOUT';
        this.message = 'request timed out';
    }
    static get code() {
        return 'ERR_JWKS_TIMEOUT';
    }
}
class JWSSignatureVerificationFailed extends JOSEError {
    constructor() {
        super(...arguments);
        this.code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
        this.message = 'signature verification failed';
    }
    static get code() {
        return 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    }
}


/***/ }),

/***/ "../oidc-browser/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs":
/*!***********************************************************************************!*\
  !*** ../oidc-browser/node_modules/@inrupt/universal-fetch/dist/index-browser.mjs ***!
  \***********************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Headers": () => (/* binding */ Headers),
/* harmony export */   "Request": () => (/* binding */ Request),
/* harmony export */   "Response": () => (/* binding */ Response),
/* harmony export */   "default": () => (/* binding */ indexBrowser),
/* harmony export */   "fetch": () => (/* binding */ fetch)
/* harmony export */ });
var indexBrowser = globalThis.fetch;
const { fetch, Response, Request, Headers } = globalThis;




/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.browser.ts");
/******/ 	solidClientAuthentication = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=solid-client-authn.bundle.js.map