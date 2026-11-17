(function () {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = [
        { color: "83, 211, 220", fill: "#58c7d4" },
        { color: "91, 157, 223", fill: "#6498d6" },
        { color: "117, 184, 232", fill: "#74b8e8" },
        { color: "179, 214, 235", fill: "#a8d7ef" }
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
                velocityX: (Math.random() - 0.5) * 0.35,
                velocityY: (Math.random() - 0.5) * 0.35,
                radius: 1.1 + Math.random() * 1.25,
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

            const particleCount = Math.min(64, Math.max(20, Math.round(width * height / 22000)));
            maxDistance = Math.min(150, Math.max(100, width / 9));
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
                        const opacity = (1 - distance / maxDistance) * 0.2;
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
                context.shadowBlur = 8;
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
