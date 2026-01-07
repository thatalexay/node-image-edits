'use strict'

/**
 * Root Route
 * GET / - Simple HTML landing page
 */
module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    reply.type('text/html; charset=utf-8')
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>node-image-editing</title></head><body><h1>node-image-editing</h1></body></html>'
  })
}
