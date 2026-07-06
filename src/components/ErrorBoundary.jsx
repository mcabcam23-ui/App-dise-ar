import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'Segoe UI, sans-serif', maxWidth: 560 }}>
          <h1 style={{ marginTop: 0 }}>No se pudo cargar Estudio</h1>
          <p style={{ color: '#444' }}>
            La aplicación encontró un error. Prueba a recargar la página. Si acabas de clonar el
            proyecto, ejecuta <code>npm install</code> y luego <code>npm run dev</code>.
          </p>
          <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12 }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
