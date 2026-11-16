(function () {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = [
        { color: "125, 216, 169", fill: "#51c789" },
        { color: "245, 144, 152", fill: "#ed6875" },
        { color: "244, 208, 136", fill: "#efc767" },
        { color: "145, 206, 222", fill: "#63bddc" }
    ];

    document.addEventListener("DOMContentLoaded", function () {
        const canvas = document.createElement("canvas");
        canvas.className = "particle-network";
        canvas.setAttribute("aria-hidden", "true");

        const context = canvas.getContext("2d");
        if (!context) {
            console.error("Particle animation could not initialize a 2D canvas context.");
            return;
        }

        document.body.appendChild(canvas);

        let width = 0;
        let height = 0;
        let particles = [];
        let maxDistance = 130;
        let animationStarted = false;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        function createParticle() {
            const paletteIndex = Math.floor(Math.random() * palette.length);
            return {
                x: Math.random() * width,
                y: Math.random() * height,
                velocityX: (Math.random() - 0.5) * 0.45,
                velocityY: (Math.random() - 0.5) * 0.45,
                radius: 1.3 + Math.random() * 1.5,
                color: palette[paletteIndex]
            };
        }

        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

            const particleCount = Math.min(90, Math.max(26, Math.round(width * height / 16000)));
            maxDistance = Math.min(180, Math.max(110, width / 8));
            particles = Array.from({ length: particleCount }, createParticle);

            if (reducedMotion) {
                drawFrame();
            } else if (!animationStarted) {
                animationStarted = true;
                drawFrame();
            }
        }

        function drawFrame() {
            context.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i += 1) {
                const particle = particles[i];
                particle.x += particle.velocityX;
                particle.y += particle.velocityY;

                if (particle.x < 0 || particle.x > width) {
                    particle.velocityX *= -1;
                }
                if (particle.y < 0 || particle.y > height) {
                    particle.velocityY *= -1;
                }

                for (let j = i + 1; j < particles.length; j += 1) {
                    const other = particles[j];
                    const distanceX = particle.x - other.x;
                    const distanceY = particle.y - other.y;
                    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                    if (distance < maxDistance) {
                        const opacity = (1 - distance / maxDistance) * 0.28;
                        context.beginPath();
                        context.moveTo(particle.x, particle.y);
                        context.lineTo(other.x, other.y);
                        context.strokeStyle = "rgba(" + particle.color.color + ", " + opacity + ")";
                        context.lineWidth = 1.1;
                        context.stroke();
                    }
                }
            }

            particles.forEach(function (particle) {
                context.beginPath();
                context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                context.fillStyle = particle.color.fill;
                context.shadowColor = particle.color.fill;
                context.shadowBlur = 12;
                context.fill();
                context.shadowBlur = 0;
            });

            if (!reducedMotion) {
                window.requestAnimationFrame(drawFrame);
            }
        }

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
    });
})();
