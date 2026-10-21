import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

function defaultHome(role) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/";
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      navigate(from || defaultHome(user.role), { replace: true });
    } catch {
      setError("Login failed. Check your email and password.");
    }
  }

  return (
    <main className="container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-primary" type="submit">
          Login
        </button>
      </form>
      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </main>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await register(fullName, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    }
  }

  return (
    <main className="container">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} className="form">
        <input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-primary" type="submit">
          Create Account
        </button>
      </form>
      <p>
        Already registered? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}
