/**
 * node-libcurl 5 Multi::close()/Dispose() stops the uv timer but does not
 * uv_close it or ObjectWrap::Unref(). CloseTimerAsync() does; call it after
 * Multi.close() so Jest --detectLeaks can collect the isolate.
 *
 * Resolved via dlsym against the already-loaded node_libcurl.node.
 */
#include <napi.h>
#include <string>

#ifndef _WIN32
#include <dlfcn.h>
#endif

using CloseTimerAsyncFn = void (*)(void*);

static CloseTimerAsyncFn ResolveCloseTimerAsync(const char* modulePath) {
#ifdef _WIN32
  (void)modulePath;
  return nullptr;
#else
  // Itanium ABI mangling of NodeLibcurl::Multi::CloseTimerAsync()
  static constexpr const char* kSymbol = "_ZN11NodeLibcurl5Multi15CloseTimerAsyncEv";

  if (void* fn = dlsym(RTLD_DEFAULT, kSymbol)) {
    return reinterpret_cast<CloseTimerAsyncFn>(fn);
  }

  if (modulePath && modulePath[0]) {
    // Node addons are typically RTLD_LOCAL; open the already-loaded module.
    void* handle = dlopen(modulePath, RTLD_NOW | RTLD_NOLOAD);
    if (!handle) {
      handle = dlopen(modulePath, RTLD_NOW);
    }
    if (handle) {
      if (void* fn = dlsym(handle, kSymbol)) {
        return reinterpret_cast<CloseTimerAsyncFn>(fn);
      }
    }
  }
  return nullptr;
#endif
}

static Napi::Value CloseMultiTimer(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsObject()) {
    Napi::TypeError::New(env, "Expected a Multi instance").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  void* multi = nullptr;
  napi_status status = napi_unwrap(env, info[0], &multi);
  if (status != napi_ok || multi == nullptr) {
    Napi::Error::New(env, "Failed to unwrap Multi instance").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string modulePath;
  if (info.Length() >= 2 && info[1].IsString()) {
    modulePath = info[1].As<Napi::String>().Utf8Value();
  }

  CloseTimerAsyncFn closeTimer = ResolveCloseTimerAsync(modulePath.c_str());
  if (!closeTimer) {
    Napi::Error::New(env, "CloseTimerAsync symbol not found in loaded node-libcurl")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  closeTimer(multi);
  return env.Undefined();
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("closeMultiTimer", Napi::Function::New(env, CloseMultiTimer));
  return exports;
}

NODE_API_MODULE(multi_timer_fix, Init)
