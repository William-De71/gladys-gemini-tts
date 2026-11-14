# Gemini TTS

## Presentación

Esta integración da a Gladys una **voz de Gemini**, mediante la API oficial de Gemini y su propia clave de API de Google AI Studio. Una vez elegida como voz en **Ajustes → Inteligencia artificial**, todo lo que dice Gladys pasa por Gemini: la acción de escena «reproducir una notificación» en sus altavoces y las respuestas habladas del asistente de voz. Gemini reconoce solo el idioma de cada texto, y cada voz habla todos los idiomas.

Puede elegir entre 30 voces (o una voz que haya diseñado en Google AI Studio) y dar a la voz una forma de hablar («calm and warm», «cheerful, speaking slowly»). El texto de una escena también puede contener etiquetas vocales como `<laugh>`, `<sigh>` o `<short pause>`.

Los costes quedan bajo control: el nivel gratuito no cuesta nada; en el nivel de pago, un presupuesto mensual detiene la voz antes de superarlo, y una caché de clips hace que una frase ya pronunciada («La puerta del garaje está abierta») no se vuelva a pedir nunca. La integración añade también tres disparadores de escena (el habla falla, el habla vuelve, presupuesto mensual) y un widget de panel.

Sin afiliación con Google. Todavía no probada con una clave de API de Gemini real: se agradecen los comentarios.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior.
- Una **clave de API de Gemini**: en [Google AI Studio](https://aistudio.google.com/apikey), inicie sesión con una cuenta de Google y haga clic en **Get API key**. La API de Gemini no se ofrece en todos los países.
- **Nivel gratuito**: nada que pagar, un número de solicitudes al día fijado por Google (visible en AI Studio), y Google puede usar los textos recibidos para mejorar sus productos.
- **Nivel de pago** (facturación o crédito prepago configurado en el proyecto de la clave): facturado por token, el texto enviado y el audio recibido. Unos 0,0015 $ por 10 segundos de voz con Flash-Lite y 0,0023 $ con Flash hasta el 31 de diciembre de 2026, el doble a partir del 1 de enero de 2027. Una casa que pronuncia 50 notificaciones de 5 segundos al día paga cerca de 1 $ al mes con Flash-Lite.
- **Sus datos**: cada texto que lee Gladys (notificaciones, respuestas del asistente) va a Google por HTTPS. La integración pide a Google que no guarde las solicitudes (`store: false`).

## Configuración

| Campo o botón            | Por defecto               | Significado                                                                                                |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Clave de API de Gemini   | —                         | Obligatoria. No se vuelve a mostrar, nunca se registra                                                     |
| Modelo                   | Gemini 3.8 Flash-Lite TTS | Flash-Lite es rápido y más barato; Flash es el más expresivo                                               |
| Voz                      | Kore                      | Una de las 30 voces predefinidas, con su carácter (firme, cálida, animada…)                                |
| Otra voz                 | —                         | Opcional: una voz de la biblioteca ampliada, o el identificador de una voz diseñada en AI Studio           |
| Forma de hablar          | —                         | Opcional, unas palabras en inglés: «calm and warm». Se envía con cada clip                                 |
| Calidad de audio         | 24 kHz                    | WAV a 24 o 16 kHz; un clip de más de 5 MB (unos 100 s a 24 kHz) se reduce a 16 kHz                         |
| Nivel de la clave        | Gratuito                  | Como aparece en AI Studio; en el nivel de pago, la integración estima el coste de cada clip                |
| Presupuesto mensual      | 2 $                       | Solo nivel de pago: por encima, los clips se rechazan hasta el día 1 del mes siguiente (hora del Pacífico) |
| Probar la voz            | —                         | Pronuncia una frase corta (una solicitud de la cuota) y muestra la duración del clip y el mes              |
| Listar las voces         | —                         | Sus voces personalizadas, y luego las voces del catálogo marcadas para un idioma (gratis)                  |
| Vaciar la caché de clips | —                         | Olvida las frases ya pronunciadas                                                                          |

El estado de la pantalla de configuración indica si Google acepta la clave, sin generar nada. No ve la cuota ni el crédito restante: **Probar la voz** sí.

## Uso

1. Integraciones → **Gemini TTS** → Configuración: pegue la clave de API, elija el modelo, la voz y, si lo desea, una forma de hablar; pulse **Probar la voz**.
2. Ajustes → **Inteligencia artificial**, tarjeta **Voz**: elija **Gemini TTS**.
3. En una escena, añada la acción **reproducir una notificación** en un altavoz: Gladys habla con la voz de Gemini. El asistente de voz también responde con ella.

### Elegir la voz

| Modelo                    | Nivel de pago, 10 s de voz (2026 / desde 2027) | Uso                                                    |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Gemini 3.8 Flash-Lite TTS | 0,0015 $ / 0,0030 $                            | Notificaciones diarias, rápido, un centenar de idiomas |
| Gemini 3.8 Flash TTS      | 0,0023 $ / 0,0045 $                            | La voz más expresiva, más de 130 idiomas               |

Precios comprobados en la página de precios de la API de Gemini el 14 de noviembre de 2026; el nivel gratuito es gratis para ambos. Escuche las voces en [Google AI Studio](https://aistudio.google.com/generate-speech) antes de elegir. **Listar las voces** muestra las voces de la biblioteca ampliada marcadas para un idioma (una narradora parisina, una voz canadiense…): escriba una de ellas, o el identificador `voice_…` de una voz diseñada en AI Studio, en **Otra voz**.

La forma de hablar se aplica a cada clip: manténgala corta y en inglés para obtener el mejor resultado. En el texto de una escena se conservan las etiquetas vocales de Google (`<laugh>`, `<sigh>`, `<whispers>`, `<short pause>`, `<long pause>`…); cualquier otra etiqueta `<…>` y el Markdown de las respuestas del asistente se eliminan antes del envío.

### Widget de panel

El widget **Voz de Gemini** muestra, en el nivel de pago con presupuesto, el gasto estimado del mes frente a él (indicador); luego el gasto o los minutos de audio del mes, los clips del día, los clips leídos de la caché este mes, los segundos de audio por día durante 30 días, si Gemini habla, el nivel, el último clip y el último error. Cuenta lo que esta integración ha enviado; la misma clave usada en otro sitio no aparece. Google AI Studio sigue siendo la referencia para la factura.

![El widget Voz de Gemini: parte del presupuesto mensual, gasto, clips del día y de la caché, segundos de audio por día, estado, nivel, último clip y último error (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-gemini-tts/main/docs/assets/widgets.es.png)

### Escenas

- **Disparador «Voz de Gemini: el habla falla»**: una vez por fallo (clave rechazada, API no habilitada, facturación o crédito, cuota diaria, límite de solicitudes, modelo desconocido, voz desconocida, API inaccesible, demasiado lento, error de Google), con el tipo, el mensaje, la voz y el idioma. Un texto rechazado por sí solo (bloqueo de seguridad, nada que decir) y el presupuesto mensual no disparan nada aquí.
- **Disparador «Voz de Gemini: vuelve a hablar»**: el primer clip tras un fallo, con los minutos de fallo.
- **Disparador «Voz de Gemini: presupuesto del mes»**: en el nivel de pago, al 80 % del presupuesto (`warning`), y luego cuando se rechaza un clip (`reached`), una vez por nivel y mes, con los dólares gastados, el presupuesto y el porcentaje.

Ejemplos: cuando se alcanza la cuota diaria, enviar un mensaje de Telegram al administrador; al 80 % del presupuesto mensual, enviar un correo con el porcentaje; cuando se alcanza el presupuesto, enviar una notificación escrita, que no cuesta nada.

No hay acción de escena: el audio lo reproduce la propia Gladys, con «reproducir una notificación».

## Solución de problemas

- **«Google ha rechazado la clave de API»**: vuelva a copiar la clave desde Google AI Studio; compruebe sus restricciones, y que la API de Gemini se ofrezca en su país.
- **«Se ha alcanzado la cuota diaria de la API de Gemini»**: el nivel gratuito permite un número de solicitudes al día; la voz vuelve al día siguiente. Las frases repetidas salen de la caché y no consumen solicitudes. Pase el proyecto al nivel de pago para tener más.
- **«Google lo rechaza por la facturación»**: el crédito prepago se ha agotado, o la facturación no está configurada; añada crédito en Google AI Studio, o vuelva a poner **Nivel de la clave** en gratuito con una clave gratuita.
- **«Se ha alcanzado el presupuesto mensual de la integración»**: los clips se rechazan hasta el día 1 del mes siguiente, hora del Pacífico; aumente el **Presupuesto mensual** para continuar.
- **«Voz rechazada»**: la voz escrita en **Otra voz** no existe, o una clave `voicekey_…` ha caducado (7 días); pulse **Listar las voces**.
- **«Google no conoce el modelo»**: Google lo ha retirado; elija el otro modelo.
- **Una respuesta larga suena más apagada**: superaba los 5 MB que acepta Gladys y se redujo a 16 kHz. No hay nada que hacer; sigue siendo clara para la voz.
- **Una frase suena distinta cada vez**: las voces de Gemini varían un poco de una generación a otra. Una frase en caché conserva su primer sonido; pulse **Vaciar la caché de clips** para volver a oírla.
- Registros: Ajustes → Supervisión, los registros de la integración. No comparta nunca su clave de API.
