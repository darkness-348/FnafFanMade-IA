import subprocess
import sys
import time
import os
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

def run():
    print("=" * 60)
    print("   UCN FNAF FANMADE - ADAPTIVE AI EXPERIENCE")
    print("=" * 60)
    print("Iniciando Servidor Backend (FastAPI en http://127.0.0.1:8000)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=BACKEND_DIR
    )

    print("Iniciando Servidor Frontend (Vite en http://localhost:5173)...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True
    )

    time.sleep(2)
    print("\n[OK] Ambos servidores iniciados exitosamente:")
    print(" -> Juego y Menú Principal: http://localhost:5173")
    print(" -> Panel de Auditoría IA:  http://localhost:5173 (o botón en Menú)")
    print(" -> API Swagger Backend:    http://127.0.0.1:8000/docs\n")
    print("Presiona Ctrl+C para detener ambos servidores.")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nDeteniendo servidores...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    run()

