import React from 'react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-brew-100 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-brew-500 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg shadow-brew-500/30">
          ☕
        </div>
        
        <div>
          <span className="inline-block px-3 py-1 bg-brew-100 text-brew-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
            Sprint 1 - Task 1
          </span>
          <h1 className="text-3xl font-extrabold text-brew-950 tracking-tight">
            BrewLite
          </h1>
          <p className="text-brew-700 text-sm mt-2">
            Hệ thống đặt & thanh toán cà phê không dùng tiền mặt
          </p>
        </div>

        <div className="p-4 bg-brew-50 rounded-2xl border border-brew-200/60 text-left space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-brew-800">
            <span>Trạng thái dự án:</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
              ✓ Khởi tạo thành công
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-brew-700">
            <span>Frontend:</span>
            <span className="font-mono font-semibold">Next.js 14 + TailwindCSS</span>
          </div>
          <div className="flex items-center justify-between text-xs text-brew-700">
            <span>Backend:</span>
            <span className="font-mono font-semibold">NestJS + REST API</span>
          </div>
          <div className="flex items-center justify-between text-xs text-brew-700">
            <span>Quy trình:</span>
            <span className="font-semibold text-brew-900">Agile Scrum (3 Sprints)</span>
          </div>
        </div>

        <div className="pt-2">
          <a
            href="/api/hello"
            target="_blank"
            rel="noreferrer"
            className="w-full inline-flex items-center justify-center py-3 px-6 rounded-xl bg-brew-600 hover:bg-brew-700 text-white font-medium shadow-md transition-all duration-200"
          >
            Kiểm tra Backend Hello API
          </a>
        </div>
      </div>
    </main>
  );
}
