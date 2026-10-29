# UCN FNAF Fanmade - Adaptive AI Experience

Fanmade de **Five Nights at Freddy's: Ultimate Custom Night** desarrollado con **React + TypeScript** en el Frontend y **Python + FastAPI** en el Backend, con un motor de **Inteligencia Artificial Adaptativa** que aprende de los movimientos y hábitos del jugador.

---

## 🎮 Controles de la Guardia Nocturna (Optimizado para 1920 x 1080)

| Tecla / Control | Acción | Descripción Visual / Textura |
|---|---|---|
| **Ratón** | Paneo Panorámico | Desplaza la oficina horizontalmente de forma suave (1920x1080). |
| **`[S]` o Barra Inferior** | Monitor de Cámaras | Eleva / Baja el monitor (`11a.png`..`11f.png`) con sonido `camera.wav`. Barra de activación: `12c.png`. |
| **`[A]` o `[Q]`** | Puerta Izquierda | Cierra la puerta metálica izquierda con luz de aviso roja (`f7.png`). |
| **`[D]`** | Puerta Derecha | Cierra la puerta metálica derecha (`10e.png`). |
| **`[W]`** | Conducto Superior | Sella la ventilación central superior (`16a.png`). **¡Salva de `2cc.png`!** |
| **`[F]`** | Escotilla Derecha | Sella el ducto diagonal inferior derecho (`17e.png`). |
| **`[Ctrl]` o `[Z]`** | Linterna Interactiva | Disipa las sombras y permite **seguir a `6f6.png`** con el cono de luz. |
| **`[E]` / Clic Taser** | Shock Eléctrico | Dispositivo (`58b.png`) que electrocuta y reinicia a la IA (Cooldown: 30s). |
| **`[Enter]` / Espacio** | Iniciar Guardia | Confirma la pantalla de controles previa e ingresa a la oficina. |
| **`[Esc]`** | Pausa / Menú | Regresa al menú principal. |

---

## 🛠️ Novedades del Sistema

1. **Modo de Prueba / Entrenamiento (Noche 0 - Sandbox)**:
   - Acceso desde el menú principal: **"MODO PRUEBA (SIN ATAQUES)"**.
   - Sin ataques de animatrónicos ni jumpscares.
   - Ideal para explorar la oficina, ajustar posiciones de puertas/ductos, subir las cámaras y observar el mapa con tranquilidad.

2. **Equilibrio de Dificultad y Pacing Natural**:
   - En la Noche 1, los ataques ahora tienen un intervalo generoso de **18 a 25 segundos** con tiempo de reacción amplio (5 a 7 segundos).
   - La frecuencia aumenta gradualmente noche a noche hasta la Noche 5/6.

3. **Sistema de Cámaras y Mapa ([`CameraMonitor.tsx`](file:///e:/Descargas/UCN/UCN/frontend/src/components/Office/CameraMonitor.tsx))**:
   - Animación de elevación auténtica con los fotogramas `11a.png` a `11f.png`.
   - Barra inferior interactiva `12c.png` o tecla **`[S]`**.
   - Mapa de instalaciones en la esquina inferior derecha: `2d1.png`.
   - **4 Cámaras con sus fondos correspondientes:**
     - **CAM 01:** `2d2.png` (Botón `32e.png`)
     - **CAM 02:** `2e9.png` (Botón `32a.png`)
     - **CAM 03:** `451.png` (Botón `32c.png`)
     - **CAM 04:** `355.png` (Botón `33b.png`)
   *(Las posiciones de los botones en el mapa se configuran fácilmente en `CAM_BUTTONS` dentro de `CameraMonitor.tsx`)*.

4. **IA Impostor Cambiaformas en Cámaras**:
   - El animatrónico impostor vaga por las 4 cámaras cambiando de habitación cada 11 segundos y adoptando diferentes formas:
     - `761.png`
     - `563.png`
     - `5fa.png`
     - `4b0.png`

5. **Emboscada del Conducto Central ([`2cc.png`](file:///e:/Descargas/UCN/UCN/Textures/2cc.png))**:
   - Cuando la IA ataca por la ventilación superior, la silueta amenazante de `2cc.png` se asoma directamente por el ducto durante **1.2 segundos**.
   - Si presionas **`[W]`** antes de que termine ese segundo, la compuerta metálica `16a.png` cae con un impacto de metal y lo repele; de lo contrario, te matará.

6. **Sombra Seguidora de Linterna ([`6f6.png`](file:///e:/Descargas/UCN/UCN/Textures/6f6.png))**:
   - La entidad en las sombras ahora utiliza la textura oficial `6f6.png`.
   - Debes buscarla en la oscuridad con la linterna (`[Ctrl]` o `[Z]`) y mantenerla iluminada hasta que la barra de disipación llegue al 100%.

---

## 🚀 Inicio Rápido

Haz doble clic en:
```bat
start.bat
```
O ejecuta en consola:
```bash
python launcher.py
```
Abre en tu navegador:
- **Juego Principal:** `http://localhost:5173`
- **Panel de Auditoría IA Independiente:** `http://localhost:5173/#/dashboard`
