# 🧠 Arquitectura y Funcionamiento de la Inteligencia Artificial Adaptativa
**Proyecto:** Five Nights at Freddy's: Ultimate Custom Night (Fanmade)  
**Tecnologías:** Python 3.13 + FastAPI + SQLite + WebSockets + React TypeScript  
**Modelo:** Aprendizaje por Refuerzo (Q-Learning) con Perfilado Heurístico de Hábitos

---

## 📌 1. Visión General del Cerebro de la IA

A diferencia de los juegos tradicionales de FNAF donde los animatrónicos se rigen por temporizadores estáticos o números aleatorios simples (AI Level 0-20), esta versión cuenta con una **IA Adaptativa en tiempo real** implementada en [`backend/app/ai_brain.py`](backend/app/ai_brain.py).

La IA opera como un **agente observador y contra-estratega**:
1. **Recopila telemetría constante:** Monitorea en vivo cada milisegundo qué puertas cierras, cuánto usas la linterna y hacia dónde estás mirando.
2. **Construye un perfil de tus debilidades:** Detecta qué sectores descuidas más (puntos ciegos).
3. **Selecciona la mejor ofensiva:** Utiliza una matriz de Q-Learning ponderada con temperatura Softmax para castigar tus descuidos sin volverse predecible.
4. **Aprende del resultado:** Si logras bloquearla con una puerta, la IA recibe una penalización (-5.0) y cambia de táctica. Si logra penetrar tu defensa, recibe una recompensa (+10.0) y refuerza ese vector.
5. **Persiste entre partidas:** Todo lo que aprende se guarda en la base de datos SQLite (`game_data.db`).

---

## 📊 2. Telemetría y Perfilado de Hábitos

Cada 100 ms (10 veces por segundo), el cliente envía un paquete de telemetría a través del WebSocket (`/ws/game`):

```json
{
  "type": "TELEMETRY",
  "telemetry": {
    "left_door": false,
    "right_door": true,
    "right_vent": false,
    "top_vent": false,
    "flashlight": false,
    "pan_x": 0.82,
    "looking_at_monitor": false
  }
}
```

El método `record_telemetry` acumula estas métricas y calcula índices de vigilancia porcentuales:
* **`left_door_usage_pct`:** % de tiempo que pasas con la puerta izquierda cerrada.
* **`right_door_usage_pct`:** % de tiempo que pasas con la puerta derecha cerrada.
* **`vent_usage_pct`:** % de tiempo que vigilas/sellas la escotilla derecha.
* **`top_vent_usage_pct`:** % de tiempo que mantienes el conducto central cerrado.
* **`flashlight_usage_pct`:** % de uso de la linterna.
* **`avg_pan_orientation`:** Hacia dónde mira el jugador (0.0 = izquierda, 0.5 = centro, 1.0 = derecha).

### Detección Automática de Puntos Ciegos (`_identify_blind_spot`)
La IA ordena todos tus sectores defensivos de menor a mayor vigilancia. El sector con el porcentaje más bajo es clasificado como tu **Punto Ciego Principal** (por ejemplo: *"Escotilla Derecha descuidada (12% de uso)"*).

---

## 🗜️ 3. Discretización de Estados (`encode_state`)

Para que el modelo de aprendizaje por refuerzo pueda generalizar sin requerir redes neuronales masivas, el estado continuo del juego se discretiza en una cadena de estado compacta:

$$\text{Estado} = \langle LD \rangle \langle RD \rangle \langle VD \rangle \langle TV \rangle \langle FL \rangle \_ \langle PAN \rangle \_ \langle HABIT \rangle$$

* **Bits defensivos (`0` o `1`):**
  * `LD`: Puerta izquierda abierta (0) o cerrada (1).
  * `RD`: Puerta derecha abierta (0) o cerrada (1).
  * `VD`: Escotilla derecha abierta (0) o sellada (1).
  * `TV`: Conducto superior abierto (0) o cerrado (1).
  * `FL`: Linterna apagada (0) o encendida (1).
* **Orientación (`L`, `C`, `R`):** Izquierda (< 0.35), Centro (0.35 - 0.65), Derecha (> 0.65).
* **Etiqueta de Hábito:**
  * `LeftBiased`: Jugador obsesionado con la puerta izquierda (> 60% uso).
  * `RightBiased`: Jugador obsesionado con la puerta derecha (> 60% uso).
  * `VentBlind`: Jugador que ignora los ductos (< 15% uso).
  * `TopVentBlind`: Jugador que olvida la ventilación del techo.
  * `Active`: Jugador balanceado.

*Ejemplo de estado:* `01000_R_LeftBiased` ➔ *Puerta derecha cerrada, mirando a la derecha, pero descuidando la izquierda y los ductos.*

---

## 🎯 4. Espacio de Acciones y Toma de Decisiones

La IA cuenta con 6 decisiones tácticas posibles:

| Acción | Objetivo / Vector | Defensa Requerida | Audio de Impacto al Bloquear |
|---|---|---|---|
| `ATTACK_RIGHT_VENT` | Infiltración por escotilla diagonal derecha. | Sellar escotilla con `[F]` (`17e.png`). | `blockb.wav` (Canal derecho) |
| `ATTACK_TOP_VENT` | Emboscada por el conducto superior (`2cc.png`). | Sellar techo con `[W]` (`16a.png`). | `ventbang.wav` / `blockb.wav` |
| `ENTER_LEFT_DOOR` | Asalto por el pasillo izquierdo. | Cerrar puerta con `[A]` (`f7.png`). | `blockb.wav` (Canal izquierdo) |
| `ENTER_RIGHT_DOOR` | Asalto por el pasillo derecho. | Cerrar puerta con `[D]` (`10e.png`). | `blockb.wav` (Canal derecho) |
| `REQUIRE_FLASHLIGHT` | Acecho en penumbras (`6f6.png`). | Iluminar y seguir con `[Ctrl]` o `[Z]`. | Siseo de retirada `breathing.wav` |
| `MOVE_SOUND` | Prueba de reflejos acústicos (`audio01.wav`). | Reacción direccional o Taser `[E]`. | `blockb.wav` / `shock.wav` |

### Selección de Acción mediante Softmax + Explotación Heurística
La probabilidad de cada acción $a$ se calcula mediante:

$$P(a) = \frac{e^{(Q(s, a) + \text{Bonus}(a)) / T}}{\sum_{a'} e^{(Q(s, a') + \text{Bonus}(a')) / T}}$$

* **Temperatura $T$ (1.2):** Controla la creatividad de la IA.
* **$\text{Bonus}(a)$:** Si tus métricas indican que tienes la escotilla desprotegida (< 30%), la acción `ATTACK_RIGHT_VENT` recibe un impulso de $+1.5$ para explotar tu debilidad de inmediato.
* **Exploración $\epsilon$-Greedy (15%):** Un 15% de las veces la IA elige una acción aleatoria para sondear si cambiaste de estrategia.

---

## 🔄 5. Regla de Actualización de Aprendizaje (Q-Update)

Cuando un ataque concluye, la IA ajusta los valores en su tabla $Q(s, a)$:

$$Q(s, a) \leftarrow Q(s, a) + \alpha \cdot \big[ R - Q(s, a) \big]$$

* **Tasa de aprendizaje $\alpha$:** $0.2$
* **Recompensa $R$:**
  * **$+10.0$ (Éxito / Penetración):** La IA encontró la puerta abierta o no alumbraste a tiempo. El vector queda registrado como altamente efectivo contra ti.
  * **$-5.0$ (Bloqueado):** Te defendiste a tiempo y el animatrónico chocó contra el metal (`blockb.wav`). La IA aprende que ese camino está custodiado y buscará una alternativa en su siguiente intento.

---

## 🎧 6. GUÍA DE COMBATE: ¿Cómo contrarrestar la Prueba de Sonido (`audio01.wav`)?

El ataque acústico corresponde a la entidad invisible **`Shadow Acoustic Stalker`**. No tiene presencia física en cámaras ni en el cristal de la oficina; su presencia se delata exclusivamente mediante el sonido **`audio01.wav`** con **audio 3D estéreo**.

Cuando escuches el sonido, se abre una ventana de reacción crítica de **3.5 a 5 segundos** (según la noche). Sigue estas instrucciones según el auricular donde lo percibas:

```
                      [OFICINA]
                         |
      IZQUIERDA          |          DERECHA
   (Auricular Izq)       |      (Auricular Der)
         │               |             │
         ▼               |             ▼
  ┌──────────────┐       |      ┌──────────────┐
  │ Puerta [A]   │       |      │ Puerta [D]   │
  │      O       │       |      │      O       │
  │ Pan L + [Ctrl]       |      │ Escotilla [F]│
  └──────────────┘       |      │      O       │
                         |      │ Pan R + [Ctrl]
                         |      └──────────────┘
                         |
                      CENTRO
                 (Ambos Canales)
                         │
                         ▼
                  ┌──────────────┐
                  │ Vista Centro │
                  │      +       │
                  │Linterna[Ctrl]│
                  └──────────────┘
```

### 1️⃣ Si el sonido se escucha por la IZQUIERDA:
* **Método 1 (El más seguro):** Pulsa **`[A]`** para cerrar la **Puerta Izquierda** (`f7.png`).
* **Método 2 (Sin gastar tanta energía):** Mueve el cursor del ratón hacia el borde izquierdo de la pantalla y pulsa la **Linterna** (**`[Ctrl]`** o **`[Z]`**). La luz ahuyentará al animatrónico del pasillo.

### 2️⃣ Si el sonido se escucha por la DERECHA:
* **Método 1:** Pulsa **`[D]`** para cerrar la **Puerta Derecha** (`10e.png`).
* **Método 2:** Pulsa **`[F]`** para sellar la **Escotilla Derecha** (`17e.png`).
* **Método 3:** Mueve el ratón hacia la derecha y enciende la **Linterna** (**`[Ctrl]`** o **`[Z]`**).

### 3️⃣ Si el sonido se escucha de FRENTE / en el CENTRO:
* Mantén el ratón en la zona central de la oficina y mantén encendida la **Linterna** (**`[Ctrl]`** o **`[Z]`**) hacia las sombras frente al escritorio.

### 4️⃣ El Botón del Pánico: Shock Eléctrico / Taser (`[E]`)
* Si estás en una situación de caos (mirando cámaras o dudando del lado): presiona **`[E]`**.
* El dispositivo **`58b.png`** liberará una descarga que **cancela el ataque acústico de inmediato** y aturde a la IA por 8 segundos. *(Tiene 30 segundos de recarga)*.

---

## 📹 7. El Impostor Cambiaformas y la Emboscada del Techo (`2cc.png`)

1. **Movimiento en Cámaras:**
   * La IA traslada al impostor entre `CAM 01`, `CAM 02`, `CAM 03` y `CAM 04` cada 11 segundos.
   * En cada salto, muta aleatoriamente en una de sus 4 apariencias:
     `761.png` | `563.png` | `5fa.png` | `4b0.png`.
2. **Ataque Sorpresa por el Techo (`2cc.png`):**
   * Cuando la IA decide atacar por el conducto superior, la criatura **`2cc.png`** se asomará visiblemente por la rejilla del techo de tu oficina.
   * **Tiempo límite:** Se queda asomada durante **1.2 segundos**.
   * **Contramedida:** Debes pulsar **`[W]`** inmediatamente para cerrar la compuerta `16a.png`. Escucharás un estruendo metálico (`ventbang.wav` / `blockb.wav`) y la criatura retrocederá.

---

## 💾 8. Persistencia y Auditoría en Tiempo Real

* **Base de Datos SQLite (`game_data.db`):**
  * `game_progress`: Registra las noches desbloqueadas, estrellas (1 a 5) y muertes.
  * `night_sessions`: Guarda el historial de cada partida (tiempo sobrevivido, batería restante, causa de muerte).
  * `ai_decisions`: Registro forense de cada decisión con la justificación textual generada por la IA.
  * `ai_knowledge_base`: Guarda la tabla de valores $Q$ y las estadísticas de hábitos acumuladas.
* **Segunda Ventana en Vivo:**
  * Puedes abrir `http://localhost:5173/#/dashboard` en un segundo monitor para ver los gráficos de tus puntos ciegos, la confianza de la IA y el registro de decisiones en vivo mientras juegas.
