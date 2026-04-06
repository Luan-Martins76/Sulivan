async function fazerLogin() {
    const email = document.querySelector(".flip-card__front input[name='email']").value;
    const password = document.querySelector(".flip-card__front input[name='password']").value;

    if (!email || !password) {
        alert("Preencha o email e a senha!");
        return;
    }

    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
        window.location.href = "/"; // vai pro painel
    } else {
        alert(data.erro);
    }
}

async function fazerCadastro() {
    const nome = document.querySelector(".flip-card__back input[type='text']").value;
    const email = document.querySelector(".flip-card__back input[name='email']").value;
    const password = document.querySelector(".flip-card__back input[name='password']").value;

    if (!nome || !email || !password) {
        alert("Preencha todos os campos!");
        return;
    }

    const response = await fetch("/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password })
    });

    const data = await response.json();

    if (response.ok) {
        alert(`Bem-vindo, ${data.nome}! Conta criada com sucesso.`);
        window.location.href = "/";
    } else {
        alert(data.erro);
    }
}
