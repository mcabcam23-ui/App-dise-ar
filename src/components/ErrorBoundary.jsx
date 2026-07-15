import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('ErrorBoundary:', error, info?.componentStack);
  }

  handleRetry() {
    this.setState({ error: null, info: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'Segoe UI, sans-serif', maxWidth: 560 }}>
          <h1 style={{ marginTop: 0 }}>No se pudo cargar Estudio</h1>
          <p style={{ color: '#444' }}>
            La aplicación encontró un error. Prueba a recargar la página o pulsa Reintentar.
            Si acabas de clonar el proyecto, ejecuta <code>npm install</code> y luego <code>npm run dev</code>.
          </p>
          <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12, maxHeight: 160 }}>
            {this.state.error.message}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={this.handleRetry} style={{ padding: '8px 16px' }}>
              Reintentar
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: '8px 16px' }}>
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
