import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let playerBox, wallBoxes = [];
const bullets = [];
const bulletSpeed = 3.0;

function init() {
    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Azul cielo

    // Cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 5); // Altura del jugador simulada

    // Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controles FPS (PointerLock)
    controls = new PointerLockControls(camera, document.body);
    document.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => console.log('Pointer locked!'));
    controls.addEventListener('unlock', () => console.log('Pointer unlocked!'));

    // Caja de colisión del jugador
    playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(1, 1.8, 1));

    // Crear el mapa básico
    createMap();

    // Iluminación
    addLights();

    // Eventos de teclado
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', shoot);

    // Ajustar tamaño en caso de redimensionar la ventana
    window.addEventListener('resize', onWindowResize);

    // Iniciar animación
    animate();
}

// Crear el mapa con un laberinto más grande
function createMap() {
    // Cargar textura de ajedrez para el suelo
    const textureLoader = new THREE.TextureLoader();
    const checkerTexture = textureLoader.load('./img/bricks.webp');

    // Configurar la repetición de la textura del suelo
    checkerTexture.wrapS = THREE.RepeatWrapping;
    checkerTexture.wrapT = THREE.RepeatWrapping;
    checkerTexture.repeat.set(40, 40); // Mayor repetición para el suelo más grande

    // Crear el suelo con la textura de ajedrez
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshPhongMaterial({ map: checkerTexture });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Colocar el suelo horizontalmente
    scene.add(floor);

    // Cargar textura de madera para las paredes
    const woodTexture = textureLoader.load('./img/woodwall.jpg');
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(10, 1); // Ajustar la repetición para las paredes más grandes

    // Generar las paredes del laberinto
    const wallHeight = 5;
    const wallThickness = 1;

    const mazeWalls = [
        // Coordenadas de paredes del laberinto (x, y, z, width, depth)
        [0, wallHeight / 2, -95, 200, wallThickness],  // Pared trasera
        [0, wallHeight / 2, 95, 200, wallThickness],   // Pared frontal
        [-95, wallHeight / 2, 0, wallThickness, 200],  // Pared izquierda
        [95, wallHeight / 2, 0, wallThickness, 200],   // Pared derecha

        // Paredes internas del laberinto (más grande)
        [0, wallHeight / 2, -80, 60, wallThickness],
        [40, wallHeight / 2, -60, 80, wallThickness],
        [-50, wallHeight / 2, -40, wallThickness, 60],
        [20, wallHeight / 2, -20, 100, wallThickness],
        [-70, wallHeight / 2, 0, wallThickness, 80],
        [50, wallHeight / 2, 20, 120, wallThickness],
        [-30, wallHeight / 2, 40, 80, wallThickness],
        [10, wallHeight / 2, 60, wallThickness, 100],
        [-80, wallHeight / 2, 80, wallThickness, 60],
        [70, wallHeight / 2, 90, 60, wallThickness],
    ];

    for (const [x, y, z, width, depth] of mazeWalls) {
        createWall(width, wallHeight, depth, x, y, z, woodTexture);
    }
}

// Crear una pared con detección de colisiones y textura
function createWall(width, height, depth, x, y, z, texture = null) {
    let wallMaterial;

    // Usar la textura si está disponible, de lo contrario, color sólido
    if (texture) {
        wallMaterial = new THREE.MeshPhongMaterial({ map: texture });
    } else {
        wallMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
    }

    // Crear geometría y material de la pared
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    wall.position.set(x, y, z);
    scene.add(wall);

    // Caja de colisión para la pared
    const wallBox = new THREE.Box3().setFromObject(wall);
    wallBoxes.push(wallBox);

    return wall;
}




// Agregar luces
function addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
}

// Disparar un rayo desde la cámara
function shoot() {
    if (!controls.isLocked) return;

    // Crear una bala
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    // Posición inicial de la bala
    bullet.position.copy(camera.position);
    scene.add(bullet);

    // Dirección de la bala
    const bulletDirection = new THREE.Vector3();
    camera.getWorldDirection(bulletDirection);
    bullets.push({ mesh: bullet, direction: bulletDirection });
}

// Animación
function animate() {
    requestAnimationFrame(animate);

    // Actualizar colisiones y movimiento del jugador
    updatePlayerPosition();

    // Actualizar balas
    updateBullets();

    renderer.render(scene, camera);
}

// Actualizar posición del jugador con colisiones
function updatePlayerPosition() {
    if (controls.isLocked) {
        direction.set(0, 0, 0);

        // Obtener la dirección hacia adelante y hacia la derecha de la cámara
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Calcular dirección basada en las teclas
        if (moveForward) direction.add(forward);
        if (moveBackward) direction.add(forward.negate());
        if (moveLeft) direction.add(right.negate());
        if (moveRight) direction.add(right);

        direction.normalize();

        // Aplicar velocidad y calcular nueva posición
        velocity.z -= direction.z * 0.03;
        velocity.x -= direction.x * 0.03;

        const deltaPosition = new THREE.Vector3(-velocity.x, 0, -velocity.z);
        const newPosition = camera.position.clone().add(deltaPosition);

        // Actualizar caja de colisión del jugador
        playerBox.setFromCenterAndSize(newPosition, new THREE.Vector3(1, 1.8, 1));

        // Verificar colisiones con las paredes
        let collision = false;
        for (const wallBox of wallBoxes) {
            if (playerBox.intersectsBox(wallBox)) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            camera.position.copy(newPosition);
        }

        // Frenar movimiento
        velocity.x *= 0.9;
        velocity.z *= 0.9;
    }
}


// Actualizar balas
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.addScaledVector(bullet.direction, bulletSpeed);

        // Eliminar la bala si está fuera del rango
        if (bullet.mesh.position.length() > 100) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
        }
    }
}

// Eventos de teclado
function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

// Ajustar el tamaño del renderizador al redimensionar la ventana
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
