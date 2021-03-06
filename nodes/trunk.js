module.exports = function (RED) {
  const { WazoApiClient } = require('@wazo/sdk');
  const fetch = require('node-fetch');
  const https = require("https");

  const agent = new https.Agent({
    rejectUnauthorized: false
  });

  function trunk(n) {
    RED.nodes.createNode(this, n);
    this.trunk_id = n.trunk_id;
    wazoConn = RED.nodes.getNode(n.server);
    this.client = wazoConn.client.calld;

    var node = this;

    wazoConn.authenticate().then(data => {
      if (data) {
        initListTrunks();
      }
    });

    node.on('input', msg => {
      if (msg.name == 'trunk_status_updated') {
        if (msg.data.id == node.trunk_id) {
          node.log(`Trunk ${node.trunk_id} event`);
          setStatus(msg.data);
          node.send(msg);
        }
      }
    });

    function setStatus(data) {
      if (data.registered) {
        node.status({fill:"green", shape:"dot", text: `register - calls: ${data.current_call_count}`})
      } else {
        node.status({fill:"red", shape:"dot", text: `unregister - calls: ${data.current_call_count}`})
      }
    };

    async function initListTrunks() {
      const trunks = await node.client.listTrunks();
      trunks.items.map(item => {
        if (item.id == node.trunk_id) {
          setStatus(item);
        }
      });
    }

  }


  // FIXME: Remove when SDK will be ready
  async function listTrunks(url, token) {
    const options = {
        method: 'GET',
        agent: agent,
        headers: {
          'content-type': 'application/json',
          'X-Auth-Token': token
        }
    };

    return fetch(url, options).then(response => response.json()).then(data => data);
  }

  RED.httpAdmin.post('/wazo-platform/trunks', RED.auth.needsPermission('wazo.write'), async function(req, res) {
    client = new WazoApiClient({
      server: `${req.body.host}:${req.body.port}`,
      agent: agent,
      clientId: 'wazo-nodered'
    });

    try {
      const { ...authentication } = await client.auth.refreshToken(req.body.refreshToken);
      client.setToken(authentication.token);
      try {
        // FIXME: Remove when SDK will be ready
        // const { ...trunks } = await client.confd.listTrunks();

        const url = `https://${req.body.host}:${req.body.port}/api/confd/1.1/trunks`;
        const { ...trunks } = await listTrunks(url, authentication.token);
        res.json(trunks);
      }
      catch(err) {
        res.send(err);
      }
    }
    catch(err) {
      res.send(err);
    }
  });

  RED.nodes.registerType("wazo trunk", trunk);

}
