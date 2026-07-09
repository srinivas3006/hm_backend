const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { buildOpenApiSpec } = require('./openapiSpec');

const swaggerSpec = swaggerJsdoc({
  definition: buildOpenApiSpec(),
  apis: ['./src/routes/*.js', './src/controllers/*.js']
});

function mountSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'HM Backend API Docs'
  }));

  app.get('/api/docs.json', (req, res) => {
    res.json(swaggerSpec);
  });
}

module.exports = {
  mountSwagger,
  swaggerSpec
};
