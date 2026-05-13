#pragma once
#include <iostream>
#ifdef __EMSCRIPTEN__
// Emscripten (WebAssembly) environment
#include <emscripten.h>
typedef double TIME_TYPE;
#elif defined(_WIN32)
#include <windows.h>
typedef LARGE_INTEGER TIME_TYPE;
#else
#include <sys/time.h>
typedef unsigned long int TIME_TYPE;
#endif

class Timer
{
    TIME_TYPE timer;
	float inverseTimerFreq;
	TIME_TYPE TimeNow()
	{
#ifdef __EMSCRIPTEN__
		// Use Emscripten's high-resolution timer (returns time in milliseconds)
		return emscripten_get_now();
#elif defined(_WIN32)
		LARGE_INTEGER val;
		QueryPerformanceCounter(&val);
		return val;
#else
		struct timeval tv;
		gettimeofday(&tv, NULL);
		TIME_TYPE val = tv.tv_sec*1000000 + tv.tv_usec;
		return val;
#endif
	}
public:
	Timer()
	{
#ifdef __EMSCRIPTEN__
		// emscripten_get_now() returns milliseconds, so convert to seconds
		inverseTimerFreq = 0.001f;
#elif defined(_WIN32)
		LARGE_INTEGER val;
		QueryPerformanceFrequency(&val);
		inverseTimerFreq = 1.0f / (float)val.QuadPart;
#else
		inverseTimerFreq = 1e-6f;
#endif
	}
	void Reset()
	{
		timer = TimeNow();
	}
	float Elapsed()
	{
#ifdef __EMSCRIPTEN__
		double elapsed = TimeNow() - timer;
		return (float)(elapsed * inverseTimerFreq);
#elif defined(_WIN32)
		long long int elapsed = TimeNow().QuadPart - timer.QuadPart;
		return (float)elapsed * inverseTimerFreq;
#else
		TIME_TYPE elapsed = TimeNow() - timer;
		return (float)elapsed * inverseTimerFreq;
#endif
	}
};
